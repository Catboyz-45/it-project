import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "เข้าสู่ระบบผู้ดูแล", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <AuthShell badge={<><ShieldCheck size={16} /> พื้นที่สำหรับผู้ดูแลระบบ</>} title={<>จัดการเว็บไซต์<br />ได้ง่ายในที่เดียว</>} description="อัปเดตบริการ สินค้า ผลงาน และข่าวสาร พร้อมระบบยืนยันตัวตนสองขั้นตอนเพื่อความปลอดภัย"><LoginForm /></AuthShell>;
}
