
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { ForgotPasswordForm } from "@/components/auth/PasswordFlowForm";

// หน้าขอลิงก์ตั้งรหัสใหม่ ไม่ต้องล็อกอิน เพราะคนที่เข้ามาคือคนที่เข้าระบบไม่ได้อยู่แล้ว
export default function ForgotPasswordPage() {
  return <AuthPageLayout
    description="กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณ"
    footer={<>นึกรหัสผ่านออกแล้ว? <a href="/login">กลับหน้าเข้าสู่ระบบ</a></>}
    title="ลืมรหัสผ่าน"
  >
    <ForgotPasswordForm />
  </AuthPageLayout>;
}
