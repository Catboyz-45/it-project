/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “lease expiry” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import type { LeaseStatus } from "@/lib/domain/enums";

const DAY_IN_MILLISECONDS = 86_400_000;

export const LEASE_EXPIRY_NOTICE_DAYS = 120;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “date Only Timestamp” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function dateOnlyTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “days Until Lease Expiry” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - endDate: ค่า “end Date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function daysUntilLeaseExpiry(endDate: Date | string, now = new Date()) {
  const endTimestamp = dateOnlyTimestamp(endDate);
  const todayTimestamp = dateOnlyTimestamp(now);
  if (endTimestamp === null || todayTimestamp === null) return null;
  return Math.round((endTimestamp - todayTimestamp) / DAY_IN_MILLISECONDS);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “lease Display Status” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - endDate: ค่า “end Date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด LeaseStatus ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function leaseDisplayStatus(status: LeaseStatus, endDate: Date | string, now = new Date()): LeaseStatus {
  if (status !== "ACTIVE" && status !== "EXPIRING") return status;
  const remainingDays = daysUntilLeaseExpiry(endDate, now);
  if (remainingDays === null) return status;
  if (remainingDays < 0) return "EXPIRED";
  if (remainingDays <= LEASE_EXPIRY_NOTICE_DAYS) return "EXPIRING";
  return "ACTIVE";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “lease Expiry Window” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function leaseExpiryWindow(now = new Date()) {
  const todayTimestamp = dateOnlyTimestamp(now);
  if (todayTimestamp === null) throw new Error("Invalid lease expiry reference date");
  return {
    from: new Date(todayTimestamp),
    to: new Date(todayTimestamp + LEASE_EXPIRY_NOTICE_DAYS * DAY_IN_MILLISECONDS),
  };
}
