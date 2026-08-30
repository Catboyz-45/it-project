/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน permissions ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import type { AdminRole } from "@prisma/client";

export type Permission = "CMS_READ" | "CMS_WRITE" | "MEDIA_WRITE" | "ADMIN_MANAGE" | "AUDIT_READ" | "PURGE_EARLY";
const permissions: Record<AdminRole, ReadonlySet<Permission>> = {
  EDITOR: new Set(["CMS_READ", "CMS_WRITE", "MEDIA_WRITE"]),
  SUPER_ADMIN: new Set(["CMS_READ", "CMS_WRITE", "MEDIA_WRITE", "ADMIN_MANAGE", "AUDIT_READ", "PURGE_EARLY"]),
};
/** ตรวจเงื่อนไขผ่าน can; คืนผลสำเร็จเฉพาะเมื่อข้อมูลตรงกฎที่ระบบยอมรับ */
export function can(role: AdminRole, permission: Permission) { return permissions[role].has(permission); }
