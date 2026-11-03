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
