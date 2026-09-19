import type { LeaseStatus } from "@/lib/domain/enums";

const DAY_IN_MILLISECONDS = 86_400_000;

// เตือนล่วงหน้า 120 วัน ให้เวลาพอจะคุยต่อสัญญาหรือหาผู้เช่าใหม่
export const LEASE_EXPIRY_NOTICE_DAYS = 120;

// ตัดเวลาทิ้งเหลือแต่วันในระบบ UTC เพื่อให้นับจำนวนวันได้ตรงไม่ว่าเครื่องที่รันจะอยู่เขตเวลาไหน
function dateOnlyTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  // วันที่ใช้ไม่ได้ก็คืน null ให้ผู้เรียกตัดสินใจเอง ดีกว่าโยน error ขึ้นไป
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// เหลืออีกกี่วันถึงวันสิ้นสุดสัญญา ติดลบคือเลยมาแล้ว
export function daysUntilLeaseExpiry(endDate: Date | string, now = new Date()) {
  const endTimestamp = dateOnlyTimestamp(endDate);
  const todayTimestamp = dateOnlyTimestamp(now);
  if (endTimestamp === null || todayTimestamp === null) return null;
  return Math.round((endTimestamp - todayTimestamp) / DAY_IN_MILLISECONDS);
}

// ฐานข้อมูลเก็บแค่ ACTIVE ส่วน EXPIRING กับ EXPIRED คำนวณจากวันหมดอายุตอนแสดงผล
// ทำแบบนี้เพราะสถานะเปลี่ยนเองตามเวลา ถ้าเก็บลงฐานต้องมีงานเบื้องหลังคอยไล่อัปเดตทุกวัน
export function leaseDisplayStatus(status: LeaseStatus, endDate: Date | string, now = new Date()): LeaseStatus {
  // สถานะอื่นเช่นยกเลิกหรือร่าง ไม่ต้องคำนวณทับ
  if (status !== "ACTIVE" && status !== "EXPIRING") return status;
  const remainingDays = daysUntilLeaseExpiry(endDate, now);
  if (remainingDays === null) return status;
  if (remainingDays < 0) return "EXPIRED";
  if (remainingDays <= LEASE_EXPIRY_NOTICE_DAYS) return "EXPIRING";
  return "ACTIVE";
}

// ช่วงวันที่ใช้ค้นสัญญาที่ใกล้หมด ส่งเข้าเงื่อนไขของ Prisma ได้เลย
export function leaseExpiryWindow(now = new Date()) {
  const todayTimestamp = dateOnlyTimestamp(now);
  if (todayTimestamp === null) throw new Error("Invalid lease expiry reference date");
  return {
    from: new Date(todayTimestamp),
    to: new Date(todayTimestamp + LEASE_EXPIRY_NOTICE_DAYS * DAY_IN_MILLISECONDS),
  };
}
