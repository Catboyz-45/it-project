// รายชื่อหน้าทั้งหมดในพื้นที่จัดการ รวมไว้ที่เดียวเพื่อให้เมนู เส้นทาง และการเช็คสิทธิ์อ้างชุดเดียวกัน
// พิมพ์ชื่อหน้าผิด TypeScript จะฟ้องตั้งแต่ตอนเขียน ไม่ต้องรอไปเจอลิงก์เสียตอนรัน
export type PageKey =
  | "overview"
  | "rooms"
  | "tenants"
  | "contracts"
  | "waterMeter"
  | "electricMeter"
  | "invoices"
  | "repairHistory"
  | "complaints"
  | "parcels"
  | "announcements"
  | "invitations"
  | "subscription"
  | "help"
  | "properties"
  | "account"
  | "settings";

// ตัวเลขสี่ตัวบนหัวแดชบอร์ด แยกเป็น type ไว้เพราะทั้งฝั่งเซิร์ฟเวอร์และหน้าจอใช้ร่วมกัน
export interface DashboardSummary {
  occupied: number;
  overdue: number;
  revenue: number;
  pending: number;
}
