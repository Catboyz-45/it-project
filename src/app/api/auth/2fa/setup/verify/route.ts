import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import { getSessionByToken, rotateSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { otpSchema } from "@/server/auth/validation";
import { decryptSecret } from "@/server/security/crypto";
import { generateRecoveryCodes } from "@/server/security/recovery";
import { assertSameOrigin, requestContext } from "@/server/security/request";
import { verifyTotp } from "@/server/security/totp";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value); const parsed = otpSchema.safeParse(await request.json().catch(() => null));
  if (!session || !parsed.success || !session.admin.totpSecretEncrypted || session.admin.twoFactorEnabled) return NextResponse.json({ error: "ไม่สามารถยืนยันได้" }, { status: 400 });
  const secret = decryptSecret(session.admin.totpSecretEncrypted); if (!verifyTotp(secret, session.admin.username, parsed.data.code)) return NextResponse.json({ error: "รหัสไม่ถูกต้องหรือหมดอายุ" }, { status: 401 });
  const codes = generateRecoveryCodes(); await db.$transaction([db.recoveryCode.deleteMany({ where: { adminId: session.adminId } }), db.recoveryCode.createMany({ data: codes.map(code => ({ adminId: session.adminId, codeHash: code.hash })) }), db.admin.update({ where: { id: session.adminId }, data: { twoFactorEnabled: true } })]);
  const token = await rotateSession(session.id, "TWO_FACTOR_VERIFIED"); const context = requestContext(request); await audit({ actorId: session.adminId, action: "AUTH_TOTP_ENROLLED", result: "SUCCESS", ...context });
  const response = NextResponse.json({ next: "/recovery-codes", recoveryCodes: codes.map(code => code.plain) }); response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: session.expiresAt }); return response;
}
