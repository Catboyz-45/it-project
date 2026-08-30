/**
 * หน้าที่ของไฟล์นี้: API /api/auth/recovery รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import {
  getSessionByToken,
  completeAuthentication,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/auth/session";
import { recoverySchema } from "@/server/auth/validation";
import { keyedHash } from "@/server/security/crypto";
import { normalizeRecoveryCode } from "@/server/security/recovery";
import { assertSameOrigin, requestContext } from "@/server/security/request";
import {
  authThrottleBuckets,
  clearFailures,
  recordFailure,
  retryAfterSeconds,
  throttleStatus,
} from "@/server/auth/throttle";

/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request))
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await getSessionByToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  const parsed = recoverySchema.safeParse(
    await request.json().catch(() => null),
  );
  const context = requestContext(request);
  if (!session || !parsed.success || session.twoFactorAt)
    return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  const throttleBuckets = authThrottleBuckets(
    "recovery",
    session.adminId,
    context.ipHash,
  );
  const lockedUntil = await throttleStatus(throttleBuckets);
  if (lockedUntil)
    return NextResponse.json(
      {
        error: "ไม่สามารถยืนยันรหัสได้ในขณะนี้",
        retryAfter: lockedUntil.toISOString(),
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds(lockedUntil)) },
      },
    );
  const codeHash = keyedHash(normalizeRecoveryCode(parsed.data.code));
  const consumed = await db.recoveryCode.updateMany({
    where: { adminId: session.adminId, codeHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) {
    const nextLock = await recordFailure(throttleBuckets);
    await audit({
      actorId: session.adminId,
      action: "AUTH_RECOVERY_CODE",
      result: "FAILURE",
      ...context,
    });
    return NextResponse.json(
      {
        error: "รหัสไม่ถูกต้องหรือถูกใช้แล้ว",
        ...(nextLock ? { retryAfter: nextLock.toISOString() } : {}),
      },
      {
        status: nextLock ? 429 : 401,
        headers: nextLock
          ? { "Retry-After": String(retryAfterSeconds(nextLock)) }
          : undefined,
      },
    );
  }
  await clearFailures(throttleBuckets);
  const token = await completeAuthentication(session.id, session.adminId);
  await audit({
    actorId: session.adminId,
    action: "AUTH_RECOVERY_CODE",
    result: "SUCCESS",
    ...context,
  });
  const response = NextResponse.json({ next: "/admin" });
  response.cookies.set(SESSION_COOKIE, token, {
    ...sessionCookieOptions,
    expires: session.expiresAt,
  });
  return response;
}
