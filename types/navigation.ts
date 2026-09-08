/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: รวม TypeScript type ของ “navigation” เพื่อบอกโครงสร้างข้อมูลที่ส่วนต่าง ๆ ต้องใช้ร่วมกัน
 * การทำงาน: ไม่มีข้อมูลจริงอยู่ในไฟล์นี้ แต่ช่วยให้ compiler แจ้งเตือนเมื่อส่งข้อมูลผิดรูปแบบก่อนนำระบบไปรัน
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Page Key” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Dashboard Summary” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface DashboardSummary {
  occupied: number;
  overdue: number;
  revenue: number;
  pending: number;
}
