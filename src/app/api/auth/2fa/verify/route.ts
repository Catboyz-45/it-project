import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/server/auth/audit";
import { getSessionByToken, rotateSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { otpSchema } from "@/server/auth/validation";
import { decryptSecret } from "@/server/security/crypto";
import { assertSameOrigin, requestContext } from "@/server/security/request";
import { verifyTotp } from "@/server/security/totp";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const parsed = otpSchema.safeParse(await request.json().catch(() => null)); const session = await getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value); const context = requestContext(request);
  if (!parsed.success || !session || session.twoFactorAt || !session.admin.twoFactorEnabled || !session.admin.totpSecretEncrypted) return NextResponse.json({ error: "ไม่สามารถยืนยันรหัสได้" }, { status: 401 });
  if (!verifyTotp(decryptSecret(session.admin.totpSecretEncrypted), session.admin.username, parsed.data.code)) { await audit({ actorId: session.adminId, action: "AUTH_TOTP", result: "FAILURE", ...context }); return NextResponse.json({ error: "รหัสไม่ถูกต้องหรือหมดอายุ" }, { status: 401 }); }
  const token = await rotateSession(session.id, "TWO_FACTOR_VERIFIED"); await audit({ actorId: session.adminId, action: "AUTH_TOTP", result: "SUCCESS", ...context });
  const response = NextResponse.json({ next: "/admin" }); response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: session.expiresAt }); return response;
}
