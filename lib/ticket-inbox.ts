// รูปแบบเรื่องแจ้งในกล่องข้อความรวมของแชทเล็ก ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์

export type TicketInboxStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";

export type TicketInboxItem = {
  id: string;
  type: "REPAIR" | "COMPLAINT";
  title: string;
  detail: string;
  status: TicketInboxStatus;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  // ร้องเรียนแบบไม่ระบุชื่อ เจ้าของหอไม่เห็นห้องและชื่อผู้แจ้ง
  roomNumber: string | null;
  tenantName: string | null;
  lastMessage: { body: string; fromSelf: boolean; hasAttachment: boolean } | null;
  hasUnread: boolean;
  attachments: Array<{ id: string; fileName: string; mimeType: string }>;
  statusEvents: Array<{ id: string; toValue: string; createdAt: string }>;
};

// บอกหน้าอื่นที่เปิดอยู่ว่าเรื่องแจ้งเปลี่ยน เช่นตอบหรือเลื่อนสถานะจากแชทเล็ก หน้าแจ้งซ่อมจะได้โหลดใหม่
export const ticketsChangedEvent = "nestly:tickets-changed";

// เรื่องที่ยกเลิกแล้วตอบไม่ได้ทั้งสองฝั่ง เรื่องที่เสร็จแล้วผู้เช่าตอบไม่ได้ แต่หอยังตามงานต่อได้
// ผู้เช่าที่ยังเจอปัญหาเดิมให้แจ้งเรื่องใหม่ หอจะได้เห็นเป็นงานค้างในรายการ ไม่จมอยู่ในเรื่องที่ปิดไปแล้ว
export function ticketAcceptsReplies(status: TicketInboxStatus, viewer: "ADMIN" | "TENANT") {
  if (status === "CANCELLED") return false;
  return !(viewer === "TENANT" && status === "RESOLVED");
}

export function closedTicketNotice(status: TicketInboxStatus) {
  return status === "CANCELLED"
    ? "เรื่องนี้ถูกยกเลิกแล้ว อ่านข้อความเดิมได้ แต่ส่งข้อความใหม่ไม่ได้"
    : "เรื่องนี้เสร็จแล้ว ถ้ายังมีปัญหาอยู่ แจ้งเรื่องใหม่ได้เลย";
}
