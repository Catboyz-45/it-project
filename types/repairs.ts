/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: รวม TypeScript type ของ “repairs” เพื่อบอกโครงสร้างข้อมูลที่ส่วนต่าง ๆ ต้องใช้ร่วมกัน
 * การทำงาน: ไม่มีข้อมูลจริงอยู่ในไฟล์นี้ แต่ช่วยให้ compiler แจ้งเตือนเมื่อส่งข้อมูลผิดรูปแบบก่อนนำระบบไปรัน
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Owner Repair Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type OwnerRepairStatus = "review" | "approved" | "scheduled" | "in_progress" | "done" | "rejected";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Owner Repair Ticket” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type OwnerRepairTicket = {
  approvedAt?: string;
  category: string;
  completedAt?: string;
  detail: string;
  id: string;
  priority: "ปกติ" | "ด่วน";
  rejectedAt?: string;
  roomId: string;
  scheduledAt?: string;
  status: OwnerRepairStatus;
  title: string;
  updatedAt: string;
};

export const repairStatusLabel: Record<OwnerRepairStatus, string> = {
  approved: "อนุมัติแล้ว",
  done: "เสร็จแล้ว",
  in_progress: "กำลังซ่อม",
  rejected: "ไม่อนุมัติ",
  review: "รออนุมัติ",
  scheduled: "นัดช่าง",
};

export const repairStatusClass: Record<OwnerRepairStatus, string> = {
  approved: "badge badge-approved",
  done: "badge badge-done",
  in_progress: "badge badge-in-progress",
  rejected: "badge badge-rejected",
  review: "badge badge-new",
  scheduled: "badge badge-scheduled",
};
