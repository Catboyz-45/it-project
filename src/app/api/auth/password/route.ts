import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import { getSessionByToken, revokeUserSessions, rotateSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { passwordSchema } from "@/server/auth/validation";
import { hashPassword } from "@/server/security/crypto";
import { assertSameOrigin, requestContext } from "@/server/security/request";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value); const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!session || !parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction([db.admin.update({ where: { id: session.adminId }, data: { passwordHash, mustChangePassword: false } }), db.session.updateMany({ where: { adminId: session.adminId, id: { not: session.id }, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "PASSWORD_CHANGED" } })]);
  const token = await rotateSession(session.id, "PASSWORD_VERIFIED"); const context = requestContext(request); await audit({ actorId: session.adminId, action: "AUTH_PASSWORD_CHANGED", result: "SUCCESS", ...context });
  const next = session.admin.twoFactorEnabled ? "/verify-2fa" : "/setup-2fa"; const response = NextResponse.json({ next }); response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: session.expiresAt }); return response;
}
