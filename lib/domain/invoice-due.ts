// คำนวณว่าบิลเลยวันครบกำหนดมากี่วัน ใช้บอกผู้เช่าให้เห็นชัดว่าต้องรีบจ่าย
// วันครบกำหนดเก็บเป็นวันล้วน (เที่ยงคืน UTC) ส่วนวันนี้ใช้วันตามปฏิทินของเครื่องผู้ใช้
// เทียบกันแบบวันต่อวัน ไม่สนชั่วโมง จะได้ไม่ขึ้นว่าเลยกำหนดตั้งแต่ตีหนึ่งของวันครบกำหนด
const dayMs = 24 * 60 * 60 * 1000;

export function daysPastDue(dueDate: string | Date, now = new Date()) {
  const due = new Date(dueDate);
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - dueDay) / dayMs);
}

// ข้อความสั้นบอกสถานะวันครบกำหนด ใช้ทั้งการ์ดหน้าแรกและหัวการ์ดบิล
export function describeInvoiceDue(dueDate: string | Date, now = new Date()) {
  const days = daysPastDue(dueDate, now);
  if (days > 0) return { isLate: true, text: `เลยกำหนด ${days} วัน` };
  if (days === 0) return { isLate: false, text: "ครบกำหนดวันนี้" };
  if (days >= -3) return { isLate: false, text: `อีก ${-days} วันครบกำหนด` };
  const label = new Date(dueDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return { isLate: false, text: `ครบกำหนด ${label}` };
}
