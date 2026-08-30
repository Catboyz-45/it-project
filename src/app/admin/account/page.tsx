/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/account; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { AccountSettings } from "@/components/account-settings";
import { requireAdmin } from "@/server/auth/session";

/** สร้างส่วนหน้าจอ AccountPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function AccountPage() {
  const session = await requireAdmin();
  return <AccountSettings initialUser={{ displayName: session.admin.displayName, username: session.admin.username, role: session.admin.role, twoFactorEnabled: session.admin.twoFactorEnabled }} />;
}
