/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /change-password; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { ChangePasswordForm } from "@/components/change-password-form";
/** สร้างส่วนหน้าจอ ChangePasswordPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function ChangePasswordPage() { return <AuthShell badge={<><KeyRound size={16} /> เริ่มต้นใช้งานครั้งแรก</>} title={<>สร้างบัญชีให้<br />พร้อมใช้งาน</>} description="เปลี่ยนรหัสผ่านชั่วคราวและตั้งค่าความปลอดภัยก่อนเข้าสู่ระบบจัดการ"><ChangePasswordForm /></AuthShell>; }
