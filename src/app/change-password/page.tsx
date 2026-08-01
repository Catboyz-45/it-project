import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { ChangePasswordForm } from "@/components/change-password-form";
export default function ChangePasswordPage() { return <AuthShell badge={<><KeyRound size={16} /> เริ่มต้นใช้งานครั้งแรก</>} title={<>สร้างบัญชีให้<br />พร้อมใช้งาน</>} description="เปลี่ยนรหัสผ่านชั่วคราวและตั้งค่าความปลอดภัยก่อนเข้าสู่ระบบจัดการ"><ChangePasswordForm /></AuthShell>; }
