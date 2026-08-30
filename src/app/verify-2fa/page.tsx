/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /verify-2fa; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { ArrowLeft, Smartphone } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { OtpForm } from "@/components/otp-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ยืนยันตัวตนสองขั้นตอน", robots: { index: false, follow: false } };

/** สร้างส่วนหน้าจอ Verify2FAPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function Verify2FAPage() {
  return <AuthShell badge={<><Smartphone size={16} /> ขั้นตอนที่ 2 จาก 2</>} title={<>อีกขั้นเพื่อ<br />ความปลอดภัย</>} description="เปิดแอป Authenticator แล้วกรอกรหัส 6 หลักที่แสดงบนหน้าจอ"><OtpForm /><div className="auth-link-row"><Link className="btn btn-ghost" href="/login"><ArrowLeft size={16} /> กลับ</Link><Link className="btn btn-ghost" href="/verify-recovery">ใช้ Recovery Code</Link></div></AuthShell>;
}
