/**
 * หน้าที่ของไฟล์นี้: API /api/auth/login รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { authThrottleBuckets, clearFailures, recordFailure, retryAfterSeconds, throttleStatus } from "@/server/auth/throttle";
import { loginSchema } from "@/server/auth/validation";
import { hashPassword, verifyPassword } from "@/server/security/crypto";
import { assertSameOrigin, requestContext } from "@/server/security/request";

/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 400 });
  const context = requestContext(request); const username = parsed.data.username.toLowerCase(); const throttleBuckets = authThrottleBuckets("login", username, context.ipHash);
  const lockedUntil = await throttleStatus(throttleBuckets);
  if (lockedUntil) return NextResponse.json({ error: "ไม่สามารถเข้าสู่ระบบได้ในขณะนี้", retryAfter: lockedUntil.toISOString() }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds(lockedUntil)) } });
  const user = await db.admin.findUnique({ where: { usernameNormalized: username } });
  const valid = user ? await verifyPassword(user.passwordHash, parsed.data.password) : (await hashPassword(parsed.data.password), false);
  if (!user || !valid || !user.isActive || user.deletedAt) {
    const nextLock = await recordFailure(throttleBuckets); await audit({ action: "AUTH_LOGIN", targetType: "AdminUser", result: "FAILURE", ...context });
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", ...(nextLock ? { retryAfter: nextLock.toISOString() } : {}) }, { status: nextLock ? 429 : 401, headers: nextLock ? { "Retry-After": String(retryAfterSeconds(nextLock)) } : undefined });
  }
  await clearFailures(throttleBuckets);
  const { token, session } = await createSession(user.id, "PASSWORD_VERIFIED", context);
  const next = user.mustChangePassword ? "/change-password" : user.twoFactorEnabled ? "/verify-2fa" : "/setup-2fa";
  await audit({ actorId: user.id, action: "AUTH_PASSWORD_VERIFIED", targetType: "AdminSession", targetId: session.id, result: "SUCCESS", ...context });
  const response = NextResponse.json({ next }); response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: session.expiresAt }); return response;
}
