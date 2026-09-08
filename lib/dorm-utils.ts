/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโมดูลกลาง “dorm utils” ที่รวม type ค่าคงที่ หรือฟังก์ชันซึ่งหลายส่วนของระบบใช้ร่วมกัน
 * การทำงาน: ช่วยให้กฎและรูปแบบข้อมูลมีแหล่งอ้างอิงเดียว ลดความซ้ำ และทำให้เปลี่ยนพฤติกรรมได้โดยแก้จุดเดียว
 */

import type { Invoice, PaymentStatus, RepairStatus, RoomStatus } from "@/types/dorm";

export const currency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export const statusText: Record<RoomStatus | PaymentStatus | RepairStatus, string> = {
  available: "ว่าง",
  occupied: "มีผู้เช่า",
  draft: "ฉบับร่าง",
  overdue: "ค้างชำระ",
  maintenance: "ซ่อมบำรุง",
  paid: "จ่ายแล้ว",
  pending: "รอชำระ",
  cancelled: "ยกเลิก",
  new: "รับเรื่อง",
  scheduled: "นัดช่าง",
  done: "เสร็จแล้ว",
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “total Invoice” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - invoice: ค่า “invoice” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function totalInvoice(invoice: Invoice) {
  return invoice.rent + invoice.water + invoice.electricity + invoice.service;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Status Class” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function getStatusClass(status: RoomStatus | PaymentStatus | RepairStatus) {
  return `badge badge-${status}`;
}
