/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /verify-recovery; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { RecoveryLogin } from "@/components/recovery-login";
/** สร้างส่วนหน้าจอ VerifyRecoveryPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function VerifyRecoveryPage() { return <AuthShell badge={<><KeyRound size={16} /> ทางเลือกสำรอง</>} title={<>กลับเข้าสู่ระบบ<br />อย่างปลอดภัย</>} description="ใช้ Recovery Code หนึ่งรหัสแทนรหัสจากแอป Authenticator"><RecoveryLogin /><Link className="btn btn-ghost" style={{ marginTop: 18 }} href="/verify-2fa"><ArrowLeft size={16} /> กลับไปใช้ Authenticator</Link></AuthShell>; }
