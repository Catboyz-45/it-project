/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโมดูลกลาง “tenant record view” ที่รวม type ค่าคงที่ หรือฟังก์ชันซึ่งหลายส่วนของระบบใช้ร่วมกัน
 * การทำงาน: ช่วยให้กฎและรูปแบบข้อมูลมีแหล่งอ้างอิงเดียว ลดความซ้ำ และทำให้เปลี่ยนพฤติกรรมได้โดยแก้จุดเดียว
 */

export const TENANT_RECORD_VIEW_IDS = ["current", "history"] as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Tenant Record View” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type TenantRecordView = (typeof TENANT_RECORD_VIEW_IDS)[number];

export const TENANT_INVOICE_VIEW_STATUSES = {
  current: ["PENDING", "OVERDUE"],
  history: ["PAID", "CANCELLED"],
} as const satisfies Record<TenantRecordView, readonly string[]>;

export const TENANT_PARCEL_VIEW_STATUSES = {
  current: ["WAITING"],
  history: ["RECEIVED"],
} as const satisfies Record<TenantRecordView, readonly string[]>;

export const TENANT_TICKET_VIEW_STATUSES = {
  current: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"],
  history: ["RESOLVED", "CANCELLED"],
} as const satisfies Record<TenantRecordView, readonly string[]>;
