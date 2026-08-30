/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/admins; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { AdminAccounts } from "@/components/admin-accounts";
import { requireAdmin } from "@/server/auth/session";
/** สร้างส่วนหน้าจอ AdminsPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function AdminsPage() { await requireAdmin(["SUPER_ADMIN"]); return <AdminAccounts />; }
