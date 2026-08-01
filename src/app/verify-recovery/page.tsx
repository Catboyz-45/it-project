import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { RecoveryLogin } from "@/components/recovery-login";
export default function VerifyRecoveryPage() { return <AuthShell badge={<><KeyRound size={16} /> ทางเลือกสำรอง</>} title={<>กลับเข้าสู่ระบบ<br />อย่างปลอดภัย</>} description="ใช้ Recovery Code หนึ่งรหัสแทนรหัสจากแอป Authenticator"><RecoveryLogin /><Link className="btn btn-ghost" style={{ marginTop: 18 }} href="/verify-2fa"><ArrowLeft size={16} /> กลับไปใช้ Authenticator</Link></AuthShell>; }
