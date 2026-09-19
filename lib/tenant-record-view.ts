// หน้าฝั่งผู้เช่าทุกหน้าแบ่งเป็นสองมุมมองเหมือนกันหมด กำลังดำเนินการ กับ ประวัติ
export const TENANT_RECORD_VIEW_IDS = ["current", "history"] as const;

export type TenantRecordView = (typeof TENANT_RECORD_VIEW_IDS)[number];

// จับคู่ว่ามุมมองไหนครอบคลุมสถานะอะไรบ้าง
// satisfies บังคับให้ครบทุกมุมมองตั้งแต่ตอนคอมไพล์ แต่ยังคงชนิดที่แคบไว้ให้ TypeScript ใช้ต่อได้
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
