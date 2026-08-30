/**
 * หน้าที่ของไฟล์นี้: API /api/auth/2fa/verify รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/server/auth/audit";
import {
  getSessionByToken,
  completeAuthentication,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/auth/session";
import { otpSchema } from "@/server/auth/validation";
import { readTotpSecret } from "@/server/auth/totp-secret";
import { assertSameOrigin, requestContext } from "@/server/security/request";
import { verifyTotpTimeStep } from "@/server/security/totp";
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
  const parsed = otpSchema.safeParse(await request.json().catch(() => null));
  const session = await getSessionByToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  const context = requestContext(request);
  if (
    !parsed.success ||
    !session ||
    session.twoFactorAt ||
    !session.admin.twoFactorEnabled ||
    !session.admin.totpSecretEncrypted
  )
    return NextResponse.json(
      { error: "ไม่สามารถยืนยันรหัสได้" },
      { status: 401 },
    );
  const throttleBuckets = authThrottleBuckets("totp", session.adminId, context.ipHash);
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
  const secret = await readTotpSecret(session.admin);
  const timeStep = secret
    ? verifyTotpTimeStep(secret, session.admin.username, parsed.data.code)
    : null;
  if (timeStep === null) {
    const nextLock = await recordFailure(throttleBuckets);
    await audit({
      actorId: session.adminId,
      action: "AUTH_TOTP",
      result: "FAILURE",
      ...context,
    });
    return NextResponse.json(
      {
        error: "รหัสไม่ถูกต้องหรือหมดอายุ",
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
  const token = await completeAuthentication(
    session.id,
    session.adminId,
    timeStep,
  );
  if (!token) {
    await audit({
      actorId: session.adminId,
      action: "AUTH_TOTP",
      result: "FAILURE",
      errorCode: "TOTP_REPLAYED",
      ...context,
    });
    return NextResponse.json(
      { error: "รหัสนี้ถูกใช้แล้ว กรุณารอรหัสชุดใหม่" },
      { status: 409 },
    );
  }
  await clearFailures(throttleBuckets);
  await audit({
    actorId: session.adminId,
    action: "AUTH_TOTP",
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
