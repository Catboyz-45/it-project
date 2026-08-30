/**
 * หน้าที่ของไฟล์นี้: API /api/auth/2fa/setup/verify รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
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
import { otpSchema } from "@/server/auth/validation";
import { readTotpSecret } from "@/server/auth/totp-secret";
import { claimTotpTimeStep } from "@/server/auth/totp-replay";
import { generateRecoveryCodes } from "@/server/security/recovery";
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
  const session = await getSessionByToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  const parsed = otpSchema.safeParse(await request.json().catch(() => null));
  const context = requestContext(request);
  if (
    !session ||
    !parsed.success ||
    !session.admin.totpSecretEncrypted ||
    session.admin.twoFactorEnabled
  ) {
    if (session) {
      await audit({
        actorId: session.adminId,
        action: "AUTH_TOTP_ENROLLED",
        result: "FAILURE",
        errorCode: "INVALID_ENROLLMENT_STATE",
        ...context,
      });
    }
    return NextResponse.json({ error: "ไม่สามารถยืนยันได้" }, { status: 400 });
  }
  const throttleBuckets = authThrottleBuckets(
    "totp-enrollment",
    session.adminId,
    context.ipHash,
  );
  const lockedUntil = await throttleStatus(throttleBuckets);
  if (lockedUntil) {
    await audit({
      actorId: session.adminId,
      action: "AUTH_TOTP_ENROLLED",
      result: "FAILURE",
      errorCode: "RATE_LIMITED",
      ...context,
    });
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
  }
  const secret = await readTotpSecret(session.admin);
  if (!secret)
    return NextResponse.json({ error: "ไม่สามารถยืนยันได้" }, { status: 400 });
  const timeStep = verifyTotpTimeStep(
    secret,
    session.admin.username,
    parsed.data.code,
  );
  if (timeStep === null) {
    const nextLock = await recordFailure(throttleBuckets);
    await audit({
      actorId: session.adminId,
      action: "AUTH_TOTP_ENROLLED",
      result: "FAILURE",
      errorCode: "INVALID_TOTP",
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
  const codes = generateRecoveryCodes();
  const enrolled = await db.$transaction(async tx => {
    if (!(await claimTotpTimeStep(tx, session.adminId, timeStep))) return false;
    await tx.recoveryCode.deleteMany({ where: { adminId: session.adminId } });
    await tx.recoveryCode.createMany({
      data: codes.map((code) => ({
        adminId: session.adminId,
        codeHash: code.hash,
      })),
    });
    await tx.admin.update({
      where: { id: session.adminId },
      data: { twoFactorEnabled: true },
    });
    return true;
  });
  if (!enrolled) {
    await audit({
      actorId: session.adminId,
      action: "AUTH_TOTP_ENROLLED",
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
  const token = await completeAuthentication(session.id, session.adminId);
  await audit({
    actorId: session.adminId,
    action: "AUTH_TOTP_ENROLLED",
    result: "SUCCESS",
    ...context,
  });
  const response = NextResponse.json({
    next: "/recovery-codes",
    recoveryCodes: codes.map((code) => code.plain),
  });
  response.cookies.set(SESSION_COOKIE, token, {
    ...sessionCookieOptions,
    expires: session.expiresAt,
  });
  return response;
}
