/**
 * หน้าที่ของไฟล์นี้: API /api/auth/2fa/setup รองรับ GET; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSessionByToken, SESSION_COOKIE } from "@/server/auth/session";
import {
  encryptNewTotpSecret,
  readTotpSecret,
} from "@/server/auth/totp-secret";
import { createTotpQr, createTotpSecret } from "@/server/security/totp";

/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET(request: NextRequest) {
  const session = await getSessionByToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (
    !session ||
    session.twoFactorAt ||
    session.admin.mustChangePassword ||
    session.admin.twoFactorEnabled
  )
    return NextResponse.json(
      { error: "ไม่สามารถตั้งค่า 2FA ได้" },
      { status: 401 },
    );
  const secret = (await readTotpSecret(session.admin)) ?? createTotpSecret();
  if (!session.admin.totpSecretEncrypted)
    await db.admin.update({
      where: { id: session.adminId },
      data: encryptNewTotpSecret(secret),
    });
  return NextResponse.json(
    { secret, qrDataUrl: await createTotpQr(secret, session.admin.username) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
