/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/company; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { AdminPageHeader } from "@/components/admin-shell";
import { CompanyForm } from "@/components/company-form";

/** สร้างส่วนหน้าจอ CompanyPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function CompanyPage() { return <><AdminPageHeader title="ข้อมูลบริษัท" description="ข้อมูลส่วนนี้จะแสดงในหน้าเกี่ยวกับเรา ติดต่อ และส่วนท้ายเว็บไซต์" /><section className="panel"><div className="panel-header"><h2>ข้อมูลทั่วไป</h2><span className="status">บันทึกอัตโนมัติ: ปิด</span></div><CompanyForm /></section></>; }
