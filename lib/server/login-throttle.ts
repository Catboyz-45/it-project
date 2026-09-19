import { createHash } from "node:crypto";
import { getDatabase } from "@/lib/server/db";

// กันเดารหัสผ่าน พลาด 5 ครั้งใน 15 นาที จะถูกล็อกอีก 15 นาที
const windowMs = 15 * 60 * 1000;
const blockMs = 15 * 60 * 1000;
const maxFailures = 5;

// นับแยกตามคู่ของอีเมลกับ IP คนอื่นที่ใช้เน็ตเดียวกันจะได้ไม่โดนล็อกไปด้วย
// เก็บเป็น hash ไม่ใช่อีเมลตรง ๆ เพราะตารางนี้ไม่จำเป็นต้องรู้ว่าใครเป็นใคร
// \0 คั่นสองค่า กันกรณีที่ต่อกันแล้วบังเอิญได้สตริงเดียวกัน
function throttleKey(email: string, ipAddress: string) {
  return createHash("sha256").update(`${email.toLowerCase()}\0${ipAddress}`).digest("hex");
}

// เช็คก่อนตรวจรหัสผ่าน ถูกล็อกอยู่ก็ไม่ต้องเสียเวลาคำนวณ hash
export async function assertLoginAllowed(email: string, ipAddress: string) {
  const record = await getDatabase().loginThrottle.findUnique({ where: { key: throttleKey(email, ipAddress) } });
  if (record?.blockedUntil && record.blockedUntil > new Date()) return false;
  return true;
}

export async function recordLoginFailure(email: string, ipAddress: string) {
  const key = throttleKey(email, ipAddress);
  const now = new Date();
  const existing = await getDatabase().loginThrottle.findUnique({ where: { key } });
  // เกิน 15 นาทีแล้วก็เริ่มนับใหม่ ไม่งั้นคนที่พิมพ์ผิดนาน ๆ ครั้งจะสะสมจนถูกล็อก
  const withinWindow = existing && now.getTime() - existing.windowStart.getTime() < windowMs;
  const failedCount = withinWindow ? existing.failedCount + 1 : 1;
  // upsert เพราะอาจเป็นความพยายามครั้งแรกของคู่นี้ หรือเป็นครั้งต่อ ๆ มาก็ได้
  await getDatabase().loginThrottle.upsert({
    where: { key },
    create: { key, failedCount, windowStart: now, blockedUntil: failedCount >= maxFailures ? new Date(now.getTime() + blockMs) : null },
    update: { failedCount, windowStart: withinWindow ? existing.windowStart : now, blockedUntil: failedCount >= maxFailures ? new Date(now.getTime() + blockMs) : null },
  });
}

// เข้าสำเร็จแล้วล้างประวัติทิ้ง จะได้ไม่มีค่าค้างไปล็อกครั้งหน้า
export async function clearLoginFailures(email: string, ipAddress: string) {
  await getDatabase().loginThrottle.deleteMany({ where: { key: throttleKey(email, ipAddress) } });
}
