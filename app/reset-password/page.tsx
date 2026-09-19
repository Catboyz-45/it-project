
import { SetPasswordForm } from "@/components/auth/PasswordFlowForm";

// หน้าตั้งรหัสใหม่จากลิงก์ในอีเมล ตัวโทเคนติดมากับ query string
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  // Next 16 ส่ง searchParams มาเป็น Promise ต้อง await ก่อนใช้
  const { token } = await searchParams;
  // ไม่มีโทเคนก็ขึ้นข้อความสั้น ๆ พอ ส่วนการตรวจว่าโทเคนใช้ได้จริงไหมทำตอนกดส่งที่ฝั่งเซิร์ฟเวอร์
  return <main className="login-shell"><section className="login-card"><h1 className="font-display text-3xl font-black">ตั้งรหัสผ่านใหม่</h1><p className="my-4 text-[#62646c]">ลิงก์นี้ใช้ได้ครั้งเดียวและมีอายุ 30 นาที</p>{token ? <SetPasswordForm token={token} /> : <p className="form-alert error">ลิงก์ไม่ถูกต้อง</p>}</section></main>;
}
