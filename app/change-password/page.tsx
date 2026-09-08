/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /change-password ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { redirect } from "next/navigation";
import { SetPasswordForm } from "@/components/auth/PasswordFlowForm";
import { getPageAuth } from "@/lib/server/auth";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Change Password Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function ChangePasswordPage() {
  const auth = await getPageAuth();
  if (!auth) redirect("/login");
  if (!auth.mustChangePassword) redirect(auth.role === "SUPER_ADMIN" ? "/super-admin" : auth.role === "TENANT" ? "/tenant" : "/admin");
  return <main className="login-shell"><section className="login-card"><h1 className="font-display text-3xl font-black">เปลี่ยนรหัสผ่านชั่วคราว</h1><p className="my-4 text-[#62646c]">ตั้งรหัสผ่านส่วนตัวก่อนเข้าใช้งานระบบ</p><SetPasswordForm forced /></section></main>;
}
