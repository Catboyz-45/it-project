/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/products; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { AdminTablePage } from "@/components/admin-table";
/** สร้างส่วนหน้าจอ AdminProductsPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function AdminProductsPage() { return <AdminTablePage title="สินค้า" description="จัดการสินค้า ยี่ห้อ รุ่น สเปก และไฟล์แคตตาล็อก" kind="products" basePath="/admin/products" />; }
