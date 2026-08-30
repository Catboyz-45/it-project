/**
 * หน้าที่ของไฟล์นี้: หน้าสำหรับกรณีไม่พบข้อมูลหรือ URL ที่ร้องขอ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
/** สร้างส่วนหน้าจอ NotFound; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function NotFound() { return <main className="section" style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center" }}><div><p className="eyebrow">404 · NOT FOUND</p><h1 className="display">ไม่พบหน้าที่ต้องการ</h1><p className="lead">ลิงก์นี้อาจถูกย้าย เปลี่ยนชื่อ หรือไม่มีอยู่แล้ว</p><Link className="btn btn-primary" href="/">กลับหน้าแรก</Link></div></main>; }
