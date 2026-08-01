import { Smartphone } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { OtpForm } from "@/components/otp-form";
export default function VerifySetupPage() { return <AuthShell badge={<><Smartphone size={16} /> ตรวจสอบการเชื่อมต่อ</>} title={<>ยืนยันว่า<br />ตั้งค่าสำเร็จ</>} description="กรอกรหัสจากบัญชีที่เพิ่งเพิ่มในแอป Authenticator"><OtpForm setup /></AuthShell>; }
