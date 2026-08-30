/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /menu; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const links = [["/", "หน้าแรก"], ["/about", "เกี่ยวกับเรา"], ["/services", "บริการ"], ["/products", "สินค้า"], ["/projects", "ผลงาน"], ["/news", "ข่าวสาร"], ["/contact", "ติดต่อเรา"]];
/** สร้างส่วนหน้าจอ MenuPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function MenuPage() { return <section className="section"><div className="container"><p className="eyebrow">MENU</p><h1 className="heading">เมนูหลัก</h1><div className="stack" style={{ marginTop: 32 }}>{links.map(([href, label]) => <Link className="card card-body cluster" style={{ justifyContent: "space-between" }} key={href} href={href}><strong>{label}</strong><ArrowRight size={18} /></Link>)}</div></div></section>; }
