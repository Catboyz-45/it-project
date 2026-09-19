import type { Invoice, PaymentStatus, RepairStatus, RoomStatus } from "@/types/dorm";

// สร้างตัวจัดรูปแบบครั้งเดียวแล้วใช้ซ้ำ เพราะการสร้าง Intl ใหม่ทุกครั้งช้ากว่ามาก
// ไม่เอาทศนิยม เพราะค่าเช่ากับค่าน้ำค่าไฟในระบบเป็นจำนวนเต็ม
export const currency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

// แปลงสถานะทุกชนิดเป็นคำไทยไว้ที่เดียว ผู้ใช้จะได้ไม่เห็นค่าดิบ
// Record บังคับให้ครอบคลุมทุกสถานะตั้งแต่ตอนคอมไพล์ เพิ่มสถานะใหม่แล้วลืมแปลจะคอมไพล์ไม่ผ่าน
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

// รวมยอดบิลไว้ที่เดียว ทุกที่เรียกตัวนี้ จะได้ไม่มีที่ไหนบวกตกหล่นไปรายการหนึ่ง
export function totalInvoice(invoice: Invoice) {
  return invoice.rent + invoice.water + invoice.electricity + invoice.service;
}

// ชื่อคลาสของป้ายสถานะ ตั้งชื่อให้ตรงกับค่าสถานะ จะได้ไม่ต้องมีตารางจับคู่อีกชุด
export function getStatusClass(status: RoomStatus | PaymentStatus | RepairStatus) {
  return `badge badge-${status}`;
}
