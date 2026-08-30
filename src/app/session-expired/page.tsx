/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /session-expired; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { Clock3, LogIn } from "lucide-react";

/** สร้างส่วนหน้าจอ SessionExpiredPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function SessionExpiredPage() { return <main className="session-card"><div className="card card-body"><span className="icon-box" style={{ marginInline: "auto" }}><Clock3 size={22} /></span><p className="eyebrow" style={{ marginTop: 24 }}>SESSION EXPIRED</p><h1 className="heading">เซสชันหมดอายุแล้ว</h1><p className="lead">เพื่อความปลอดภัย ระบบออกจากบัญชีของคุณหลังไม่มีการใช้งาน กรุณาเข้าสู่ระบบใหม่ งานที่บันทึกแล้วจะไม่สูญหาย</p><Link className="btn btn-dark" href="/login"><LogIn size={17} /> เข้าสู่ระบบอีกครั้ง</Link></div></main>; }
