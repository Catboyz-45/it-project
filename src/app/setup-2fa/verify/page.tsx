/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /setup-2fa/verify; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Smartphone } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { OtpForm } from "@/components/otp-form";
/** สร้างส่วนหน้าจอ VerifySetupPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function VerifySetupPage() { return <AuthShell badge={<><Smartphone size={16} /> ตรวจสอบการเชื่อมต่อ</>} title={<>ยืนยันว่า<br />ตั้งค่าสำเร็จ</>} description="กรอกรหัสจากบัญชีที่เพิ่งเพิ่มในแอป Authenticator"><OtpForm setup /></AuthShell>; }
