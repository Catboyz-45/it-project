import Link from "next/link";
import { ArrowLeft, Smartphone } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { OtpForm } from "@/components/otp-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ยืนยันตัวตนสองขั้นตอน", robots: { index: false, follow: false } };

export default function Verify2FAPage() {
  return <AuthShell badge={<><Smartphone size={16} /> ขั้นตอนที่ 2 จาก 2</>} title={<>อีกขั้นเพื่อ<br />ความปลอดภัย</>} description="เปิดแอป Authenticator แล้วกรอกรหัส 6 หลักที่แสดงบนหน้าจอ"><OtpForm /><div className="auth-link-row"><Link className="btn btn-ghost" href="/login"><ArrowLeft size={16} /> กลับ</Link><Link className="btn btn-ghost" href="/verify-recovery">ใช้ Recovery Code</Link></div></AuthShell>;
}
