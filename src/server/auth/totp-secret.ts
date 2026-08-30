/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน totp-secret ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { db } from "@/server/db";
import {
  currentTotpKeyVersion,
  decryptSecret,
  encryptSecret,
} from "@/server/security/crypto";

type EncryptedTotp = {
  id: string;
  totpSecretEncrypted: string | null;
  totpKeyVersion: number | null;
};

/** Decrypts a TOTP secret and opportunistically re-wraps it with the active key. */
export async function readTotpSecret(
  admin: EncryptedTotp,
): Promise<string | null> {
  if (!admin.totpSecretEncrypted) return null;
  const storedVersion = admin.totpKeyVersion ?? 1;
  const secret = decryptSecret(admin.totpSecretEncrypted, storedVersion);
  const currentVersion = currentTotpKeyVersion();
  if (storedVersion !== currentVersion) {
    await db.admin.updateMany({
      where: {
        id: admin.id,
        totpSecretEncrypted: admin.totpSecretEncrypted,
        totpKeyVersion: admin.totpKeyVersion,
      },
      data: {
        totpSecretEncrypted: encryptSecret(secret, currentVersion),
        totpKeyVersion: currentVersion,
      },
    });
  }
  return secret;
}

/** แปลงหรือจัดรูปข้อมูลด้วย encryptNewTotpSecret ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function encryptNewTotpSecret(secret: string) {
  const keyVersion = currentTotpKeyVersion();
  return {
    totpSecretEncrypted: encryptSecret(secret, keyVersion),
    totpKeyVersion: keyVersion,
  };
}
