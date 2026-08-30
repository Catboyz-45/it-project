/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /setup-2fa; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Smartphone } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { TwoFactorSetup } from "@/components/two-factor-setup";
/** สร้างส่วนหน้าจอ Setup2FAPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function Setup2FAPage() { return <AuthShell badge={<><Smartphone size={16} /> บังคับใช้กับผู้ดูแลทุกบัญชี</>} title={<>ปกป้องบัญชี<br />อีกหนึ่งขั้น</>} description="2FA ช่วยลดความเสี่ยงหากรหัสผ่านรั่วไหล และต้องตั้งค่าก่อนเข้าใช้ CMS"><TwoFactorSetup /></AuthShell>; }
