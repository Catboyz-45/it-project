import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { RecoveryCodes } from "@/components/recovery-codes";
export default function RecoveryCodesPage() { return <AuthShell compact badge={<><ShieldCheck size={16} /> สำรองการเข้าถึงบัญชี</>} title={<>เก็บกุญแจสำรอง<br />ให้ปลอดภัย</>} description="Recovery Codes ช่วยให้เข้าสู่ระบบได้เมื่อโทรศัพท์สูญหายหรือใช้งาน Authenticator ไม่ได้"><RecoveryCodes /></AuthShell>; }
