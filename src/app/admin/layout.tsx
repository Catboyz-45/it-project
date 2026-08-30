/**
 * หน้าที่ของไฟล์นี้: โครงหน้าร่วมของเส้นทางย่อยในโฟลเดอร์นี้ ใช้ครอบเนื้อหาและกำหนดส่วนที่แสดงซ้ำโดยไม่ต้องเขียนใหม่ทุกหน้า
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { AdminShell } from "@/components/admin-shell";
import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "ระบบจัดการเว็บไซต์", robots: { index: false, follow: false } };
/** สร้างส่วนหน้าจอ AdminLayout; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function AdminLayout({ children }: { children: React.ReactNode }) { const session = await requireAdmin(); return <AdminShell user={{ displayName: session.admin.displayName, username: session.admin.username, role: session.admin.role }}>{children}</AdminShell>; }
