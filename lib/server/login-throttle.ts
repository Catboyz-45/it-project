/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “login throttle” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { createHash } from "node:crypto";
import { getDatabase } from "@/lib/server/db";

const windowMs = 15 * 60 * 1000;
const blockMs = 15 * 60 * 1000;
const maxFailures = 5;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “throttle Key” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - ipAddress: ค่า “ip Address” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function throttleKey(email: string, ipAddress: string) {
  return createHash("sha256").update(`${email.toLowerCase()}\0${ipAddress}`).digest("hex");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Login Allowed” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - ipAddress: ค่า “ip Address” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function assertLoginAllowed(email: string, ipAddress: string) {
  const record = await getDatabase().loginThrottle.findUnique({ where: { key: throttleKey(email, ipAddress) } });
  if (record?.blockedUntil && record.blockedUntil > new Date()) return false;
  return true;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “record Login Failure” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - ipAddress: ค่า “ip Address” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function recordLoginFailure(email: string, ipAddress: string) {
  const key = throttleKey(email, ipAddress);
  const now = new Date();
  const existing = await getDatabase().loginThrottle.findUnique({ where: { key } });
  const withinWindow = existing && now.getTime() - existing.windowStart.getTime() < windowMs;
  const failedCount = withinWindow ? existing.failedCount + 1 : 1;
  await getDatabase().loginThrottle.upsert({
    where: { key },
    create: { key, failedCount, windowStart: now, blockedUntil: failedCount >= maxFailures ? new Date(now.getTime() + blockMs) : null },
    update: { failedCount, windowStart: withinWindow ? existing.windowStart : now, blockedUntil: failedCount >= maxFailures ? new Date(now.getTime() + blockMs) : null },
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “clear Login Failures” ตามกฎของระบบ
 * รับค่า:
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - ipAddress: ค่า “ip Address” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function clearLoginFailures(email: string, ipAddress: string) {
  await getDatabase().loginThrottle.deleteMany({ where: { key: throttleKey(email, ipAddress) } });
}
