/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/taxonomies/product-types; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
/** สร้างส่วนหน้าจอ ProductTypesPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function ProductTypesPage() { return <TaxonomyManager title="ประเภทสินค้า" description="จัดกลุ่มรูปแบบเครื่องปรับอากาศสำหรับค้นหาและกรองสินค้า" singular="ประเภทสินค้า" kind="product-types" />; }
