/**
 * หน้าที่ของไฟล์นี้: กลไกความปลอดภัย totp สำหรับตรวจคำขอ เข้ารหัส หรือยืนยันข้อมูลสำคัญก่อนระบบเชื่อถือ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

/** สร้างข้อมูลหรือเริ่มกระบวนการ createTotpSecret พร้อมใช้กฎตรวจสอบของฝั่งเซิร์ฟเวอร์ */
export function createTotpSecret(): string { return new OTPAuth.Secret({ size: 20 }).base32; }
function totp(secret: string, username: string) { return new OTPAuth.TOTP({ issuer: "อยู่เย็นเป็นสุข วิศวกรรม", label: username, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }); }
/** ตรวจเงื่อนไขผ่าน verifyTotpTimeStep; คืนผลสำเร็จเฉพาะเมื่อข้อมูลตรงกฎที่ระบบยอมรับ */
export function verifyTotpTimeStep(
  secret: string,
  username: string,
  token: string,
  now = Date.now(),
): number | null {
  const delta = totp(secret, username).validate({ token, window: 1, timestamp: now });
  return delta === null ? null : Math.floor(now / 30_000) + delta;
}
/** ตรวจเงื่อนไขผ่าน verifyTotp; คืนผลสำเร็จเฉพาะเมื่อข้อมูลตรงกฎที่ระบบยอมรับ */
export function verifyTotp(secret: string, username: string, token: string): boolean { return verifyTotpTimeStep(secret, username, token) !== null; }
/** สร้างข้อมูลหรือเริ่มกระบวนการ createTotpQr พร้อมใช้กฎตรวจสอบของฝั่งเซิร์ฟเวอร์ */
export async function createTotpQr(secret: string, username: string): Promise<string> { return QRCode.toDataURL(totp(secret, username).toString(), { errorCorrectionLevel: "M", margin: 2, width: 260 }); }
