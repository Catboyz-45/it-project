/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /reset-password ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { SetPasswordForm } from "@/components/auth/PasswordFlowForm";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Reset Password Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { searchParams }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="login-shell"><section className="login-card"><h1 className="font-display text-3xl font-black">ตั้งรหัสผ่านใหม่</h1><p className="my-4 text-[#62646c]">ลิงก์นี้ใช้ได้ครั้งเดียวและมีอายุ 30 นาที</p>{token ? <SetPasswordForm token={token} /> : <p className="form-alert error">ลิงก์ไม่ถูกต้อง</p>}</section></main>;
}
