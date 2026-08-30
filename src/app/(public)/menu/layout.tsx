/**
 * หน้าที่ของไฟล์นี้: โครงหน้าร่วมของเส้นทางย่อยในโฟลเดอร์นี้ ใช้ครอบเนื้อหาและกำหนดส่วนที่แสดงซ้ำโดยไม่ต้องเขียนใหม่ทุกหน้า
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "เมนู", robots: { index: false, follow: false } };

/** สร้างส่วนหน้าจอ MenuLayout; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function MenuLayout({ children }: { children: React.ReactNode }) { return children; }
