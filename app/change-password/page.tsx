
import { redirect } from "next/navigation";
import { SetPasswordForm } from "@/components/auth/PasswordFlowForm";
import { getPageAuth } from "@/lib/server/auth";
import { roleHomePath } from "@/lib/navigation-routes";

// ด่านบังคับเปลี่ยนรหัส สำหรับบัญชีที่แอดมินตั้งรหัสชั่วคราวให้
export default async function ChangePasswordPage() {
  const auth = await getPageAuth();
  // ต้องล็อกอินอยู่ก่อน เพราะรู้ว่าจะเปลี่ยนรหัสให้ใครจากเซสชัน
  if (!auth) redirect("/login");
  // ไม่ได้ติดธงบังคับเปลี่ยนก็ไม่ต้องอยู่หน้านี้ ส่งกลับหน้าแรกตามบทบาท
  if (!auth.mustChangePassword) redirect(roleHomePath(auth.role));
  return <main className="login-shell"><section className="login-card"><h1 className="font-display text-3xl font-black">เปลี่ยนรหัสผ่านชั่วคราว</h1><p className="my-4 text-[#62646c]">ตั้งรหัสผ่านส่วนตัวก่อนเข้าใช้งานระบบ</p><SetPasswordForm forced /></section></main>;
}
