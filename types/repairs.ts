// สถานะของใบแจ้งซ่อมตามลำดับที่เกิดจริง ตั้งแต่รออนุมัติจนปิดงาน
export type OwnerRepairStatus = "review" | "approved" | "scheduled" | "in_progress" | "done" | "rejected";

// รูปของใบแจ้งซ่อมที่ฝั่งหน้าจอใช้ วันที่เป็นสตริงเพราะส่งผ่าน JSON มาจาก API
// ฟิลด์วันที่เป็น optional เพราะยังไม่ถึงขั้นนั้นก็ยังไม่มีค่า
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

// แปลงรหัสสถานะเป็นข้อความไทย ใช้ Record บังคับให้ครบทุกสถานะ เพิ่มสถานะใหม่แล้วลืมแปลจะคอมไพล์ไม่ผ่าน
export const repairStatusLabel: Record<OwnerRepairStatus, string> = {
  approved: "อนุมัติแล้ว",
  done: "เสร็จแล้ว",
  in_progress: "กำลังซ่อม",
  rejected: "ไม่อนุมัติ",
  review: "รออนุมัติ",
  scheduled: "นัดช่าง",
};

// คลาส CSS ของป้ายสถานะ แยกจากข้อความเพื่อให้เปลี่ยนสีได้โดยไม่ต้องยุ่งกับคำแปล
export const repairStatusClass: Record<OwnerRepairStatus, string> = {
  approved: "badge badge-approved",
  done: "badge badge-done",
  in_progress: "badge badge-in-progress",
  rejected: "badge badge-rejected",
  review: "badge badge-new",
  scheduled: "badge badge-scheduled",
};
