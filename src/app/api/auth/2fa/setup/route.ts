import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSessionByToken, SESSION_COOKIE } from "@/server/auth/session";
import { decryptSecret, encryptSecret } from "@/server/security/crypto";
import { createTotpQr, createTotpSecret } from "@/server/security/totp";

export async function GET(request: NextRequest) {
  const session = await getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.twoFactorAt || session.admin.mustChangePassword || session.admin.twoFactorEnabled) return NextResponse.json({ error: "ไม่สามารถตั้งค่า 2FA ได้" }, { status: 401 });
  const secret = session.admin.totpSecretEncrypted ? decryptSecret(session.admin.totpSecretEncrypted) : createTotpSecret();
  if (!session.admin.totpSecretEncrypted) await db.admin.update({ where: { id: session.adminId }, data: { totpSecretEncrypted: encryptSecret(secret), totpKeyVersion: 1 } });
  return NextResponse.json({ secret, qrDataUrl: await createTotpQr(secret, session.admin.username) }, { headers: { "Cache-Control": "no-store" } });
}
