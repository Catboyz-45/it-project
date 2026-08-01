import { Smartphone } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { TwoFactorSetup } from "@/components/two-factor-setup";
export default function Setup2FAPage() { return <AuthShell badge={<><Smartphone size={16} /> บังคับใช้กับผู้ดูแลทุกบัญชี</>} title={<>ปกป้องบัญชี<br />อีกหนึ่งขั้น</>} description="2FA ช่วยลดความเสี่ยงหากรหัสผ่านรั่วไหล และต้องตั้งค่าก่อนเข้าใช้ CMS"><TwoFactorSetup /></AuthShell>; }
