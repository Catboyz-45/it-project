/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/projects; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { AdminTablePage } from "@/components/admin-table";
/** สร้างส่วนหน้าจอ AdminProjectsPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function AdminProjectsPage() { return <AdminTablePage title="ผลงาน" description="จัดการรายละเอียดโครงการ รูปปก และแกลเลอรี" kind="projects" basePath="/admin/projects" />; }
