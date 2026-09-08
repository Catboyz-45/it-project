/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโมดูลกลาง “ui labels” ที่รวม type ค่าคงที่ หรือฟังก์ชันซึ่งหลายส่วนของระบบใช้ร่วมกัน
 * การทำงาน: ช่วยให้กฎและรูปแบบข้อมูลมีแหล่งอ้างอิงเดียว ลดความซ้ำ และทำให้เปลี่ยนพฤติกรรมได้โดยแก้จุดเดียว
 */

const statusLabels: Record<string, string> = {
  ACCEPTED: "รับแล้ว",
  ACKNOWLEDGED: "รับทราบแล้ว",
  ACTIVE: "ใช้งานอยู่",
  APPROVED: "อนุมัติแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
  DRAFT: "ฉบับร่าง",
  ENDED: "สิ้นสุดแล้ว",
  EXPIRED: "หมดอายุ",
  EXPIRING: "ใกล้หมดอายุ",
  FAILED: "ไม่สำเร็จ",
  IN_PROGRESS: "กำลังดำเนินการ",
  OPEN: "รับเรื่องแล้ว",
  PAID: "ชำระแล้ว",
  PENDING: "รอดำเนินการ",
  PENDING_PAYMENT: "รอชำระเงิน",
  PENDING_REVIEW: "รอตรวจสอบ",
  PENDING_SIGNATURE: "รอลงนาม",
  RECEIVED: "รับแล้ว",
  REJECTED: "ไม่อนุมัติ",
  RESOLVED: "เสร็จแล้ว",
  REVOKED: "ยกเลิกคำเชิญแล้ว",
  SUCCESS: "สำเร็จ",
  SUSPENDED: "ระงับการใช้งาน",
  TRIAL: "ช่วงทดลองใช้",
  URGENT: "ด่วน",
  NORMAL: "ปกติ",
};

const auditActionLabels: Record<string, string> = {
  ACCOUNT_PASSWORD_CHANGE: "เปลี่ยนรหัสผ่านบัญชี",
  ACCOUNT_PROFILE_UPDATE: "แก้ไขข้อมูลบัญชี",
  ANNOUNCEMENT_CREATE: "สร้างประกาศ",
  ANNOUNCEMENT_UPDATE: "แก้ไขประกาศ",
  AUTH_LOGIN: "เข้าสู่ระบบ",
  AUTH_LOGOUT: "ออกจากระบบ",
  BUILDING_CREATE: "เพิ่มอาคาร",
  BUILDING_UPDATE: "แก้ไขอาคาร",
  CHAT_ATTACHMENT_SEND: "ส่งไฟล์ในแชต",
  CHAT_MESSAGE_SEND: "ส่งข้อความแชต",
  DOCUMENT_GENERATE: "สร้างเอกสาร",
  DOCUMENT_PREVIEW: "ดูตัวอย่างเอกสาร",
  DOCUMENT_TEMPLATE_UPDATE: "แก้ไขแม่แบบเอกสาร",
  FLOOR_CREATE: "เพิ่มชั้น",
  FLOOR_UPDATE: "แก้ไขชั้น",
  INVOICE_BULK_CREATE: "สร้างบิลหลายห้อง",
  INVOICE_CANCEL: "ยกเลิกบิล",
  INVOICE_CREATE: "สร้างบิล",
  INVOICE_ISSUE: "ออกบิลจากฉบับร่าง",
  INVOICE_OVERDUE_RECALCULATE: "คำนวณบิลค้างชำระใหม่",
  LEASE_CREATE: "สร้างสัญญาเช่า",
  LEASE_SIGNED_DOCUMENT_UPLOAD: "อัปโหลดสัญญาที่ลงนามแล้ว",
  MAINTENANCE_JOB_RUN: "ประมวลผลงานตามกำหนดเวลา",
  METER_READING_BULK_CREATE: "บันทึกมิเตอร์หลายห้อง",
  METER_READING_CREATE: "บันทึกมิเตอร์",
  OCCUPANCY_END: "สิ้นสุดการเข้าพัก",
  OCCUPANCY_REVIEW: "ตรวจสอบคำขอเข้าพัก",
  PARCEL_CREATE: "ลงทะเบียนพัสดุ",
  PARCEL_UPDATE: "อัปเดตพัสดุ",
  PASSWORD_RESET_COMPLETE: "ตั้งรหัสผ่านใหม่สำเร็จ",
  PASSWORD_RESET_REQUEST: "ขอตั้งรหัสผ่านใหม่",
  PASSWORD_RESET_REQUEST_THROTTLED: "ระงับคำขอตั้งรหัสผ่านชั่วคราว",
  PAYMENT_SUBMISSION_CREATE: "ส่งหลักฐานการชำระเงิน",
  PROPERTY_ADMIN_CREATE_PENDING_APPROVAL: "สร้างบัญชีเจ้าของหอเพื่อรออนุมัติ",
  PROPERTY_ADMIN_TEMPORARY_PASSWORD_ISSUE: "ออกรหัสผ่านชั่วคราว",
  PROPERTY_CATALOGS_REPLACE: "แก้ไขข้อมูลตั้งต้นของหอพัก",
  PROPERTY_CREATE: "สร้างหอพัก",
  PROPERTY_SETTINGS_UPDATE_V1: "แก้ไขการตั้งค่าหอพัก",
  PROPERTY_SUBSCRIPTION_ASSIGN: "กำหนดแพ็กเกจให้หอพัก",
  PROPERTY_UPDATE: "แก้ไขหอพัก",
  ROOM_CREATE: "เพิ่มห้องพัก",
  ROOM_UPDATE: "แก้ไขห้องพัก",
  SAAS_PLAN_CREATE: "สร้างแพ็กเกจ",
  SAAS_PLAN_UPDATE: "แก้ไขแพ็กเกจ",
  SERVICE_TICKET_ATTACHMENT_CREATE: "แนบไฟล์ในรายการแจ้งเรื่อง",
  SERVICE_TICKET_CREATE: "สร้างรายการแจ้งเรื่อง",
  SERVICE_TICKET_REPLY_CREATE: "ตอบกลับรายการแจ้งเรื่อง",
  SERVICE_TICKET_UPDATE: "อัปเดตรายการแจ้งเรื่อง",
  SUBSCRIPTION_ORDER_CREATE: "สร้างคำสั่งซื้อแพ็กเกจ",
  SUBSCRIPTION_PAYMENT_CREATE: "ส่งหลักฐานชำระค่าแพ็กเกจ",
  SUBSCRIPTION_PAYMENT_REVIEW: "ตรวจสอบการชำระค่าแพ็กเกจ",
  SUPER_ADMIN_PROPERTY_UPDATE: "ผู้ดูแลระบบแก้ไขหอพัก",
  TEMPORARY_PASSWORD_CHANGE: "เปลี่ยนรหัสผ่านชั่วคราว",
  TENANT_INVITATION_ACCEPT: "รับคำเชิญเข้าพัก",
  TENANT_INVITATION_CREATE: "สร้างคำเชิญผู้เช่า",
  TENANT_INVITATION_REVOKE: "ยกเลิกคำเชิญผู้เช่า",
  TENANT_OCCUPANCY_SELECT: "เลือกการเข้าพัก",
  TENANT_PROFILE_UPDATE: "แก้ไขข้อมูลผู้เช่า",
  TENANT_REGISTER: "สมัครบัญชีผู้เช่า",
  TENANT_UPDATE: "แก้ไขผู้เช่า",
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Status” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function formatStatus(value: string | null | undefined) {
  if (!value) return "-";
  return statusLabels[value] ?? "สถานะอื่น";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Audit Action” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - action: ค่า “action” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function formatAuditAction(action: string) {
  if (auditActionLabels[action]) return auditActionLabels[action];
  if (/^API_(POST|PUT|PATCH|DELETE)_SUCCESS$/.test(action)) return "ดำเนินการกับข้อมูลสำเร็จ";
  if (/^API_(POST|PUT|PATCH|DELETE)_FAILURE$/.test(action)) return "ดำเนินการกับข้อมูลไม่สำเร็จ";
  return "เหตุการณ์ระบบ";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Audit Result” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - result: ค่า “result” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function formatAuditResult(result: string) {
  return result === "SUCCESS" ? "สำเร็จ" : result === "FAILURE" ? "ไม่สำเร็จ" : "ไม่ทราบผล";
}
