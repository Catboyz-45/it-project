/**
 * หน้าที่ของไฟล์นี้: กลไกความปลอดภัย recovery สำหรับตรวจคำขอ เข้ารหัส หรือยืนยันข้อมูลสำคัญก่อนระบบเชื่อถือ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { keyedHash } from "./crypto";

/** แปลงหรือจัดรูปข้อมูลด้วย normalizeRecoveryCode ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function normalizeRecoveryCode(value: string): string { return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
/** สร้างข้อมูลหรือเริ่มกระบวนการ generateRecoveryCodes พร้อมใช้กฎตรวจสอบของฝั่งเซิร์ฟเวอร์ */
export function generateRecoveryCodes(count = 10): Array<{ plain: string; hash: string }> {
  return Array.from({ length: count }, () => { const raw = randomBytes(6).toString("hex").toUpperCase(); const plain = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`; return { plain, hash: keyedHash(normalizeRecoveryCode(plain)) }; });
}
