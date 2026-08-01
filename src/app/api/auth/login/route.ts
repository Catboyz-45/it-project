import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { clearFailures, recordFailure, throttleStatus } from "@/server/auth/throttle";
import { loginSchema } from "@/server/auth/validation";
import { hashPassword, keyedHash, verifyPassword } from "@/server/security/crypto";
import { assertSameOrigin, requestContext } from "@/server/security/request";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 400 });
  const context = requestContext(request); const username = parsed.data.username.toLowerCase(); const throttleKey = keyedHash(`${username}:${context.ipHash}`);
  const lockedUntil = await throttleStatus(throttleKey);
  if (lockedUntil) return NextResponse.json({ error: "ไม่สามารถเข้าสู่ระบบได้ในขณะนี้", retryAfter: lockedUntil.toISOString() }, { status: 429 });
  const user = await db.admin.findUnique({ where: { usernameNormalized: username } });
  const valid = user ? await verifyPassword(user.passwordHash, parsed.data.password) : (await hashPassword(parsed.data.password), false);
  if (!user || !valid || !user.isActive || user.deletedAt) {
    await recordFailure(throttleKey); await audit({ action: "AUTH_LOGIN", targetType: "AdminUser", result: "FAILURE", ...context });
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  await clearFailures(throttleKey);
  const { token, session } = await createSession(user.id, "PASSWORD_VERIFIED", context);
  const next = user.mustChangePassword ? "/change-password" : user.twoFactorEnabled ? "/verify-2fa" : "/setup-2fa";
  await audit({ actorId: user.id, action: "AUTH_PASSWORD_VERIFIED", targetType: "AdminSession", targetId: session.id, result: "SUCCESS", ...context });
  const response = NextResponse.json({ next }); response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: session.expiresAt }); return response;
}
