/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /login; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "เข้าสู่ระบบผู้ดูแล", robots: { index: false, follow: false } };

/** สร้างส่วนหน้าจอ LoginPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function LoginPage() {
  return <AuthShell badge={<><ShieldCheck size={16} /> พื้นที่สำหรับผู้ดูแลระบบ</>} title={<>จัดการเว็บไซต์<br />ได้ง่ายในที่เดียว</>} description="อัปเดตบริการ สินค้า ผลงาน และข่าวสาร พร้อมระบบยืนยันตัวตนสองขั้นตอนเพื่อความปลอดภัย"><LoginForm /></AuthShell>;
}
