/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/services/[slug]/edit; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { GeneralEditor } from "@/components/admin/content-editors";
/** สร้างส่วนหน้าจอ EditServicePage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function EditServicePage({ params }: { params: Promise<{ slug: string }> }) { return <GeneralEditor mode="edit" kind="service" idOrSlug={(await params).slug} />; }
