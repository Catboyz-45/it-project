/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /register ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { redirect } from "next/navigation";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { TenantRegistrationForm } from "@/components/auth/TenantRegistrationForm";
import { getPageAuth } from "@/lib/server/auth";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Register Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function RegisterPage() {
  const auth = await getPageAuth();
  if (auth) redirect(auth.role === "TENANT" ? "/tenant" : auth.role === "SUPER_ADMIN" ? "/super-admin" : "/admin");

  return <AuthPageLayout
    description="กรอกข้อมูลพร้อมรหัสเชิญที่ได้รับจากหอพัก"
    footer={<>มีบัญชีแล้ว? <a href="/login">เข้าสู่ระบบ</a></>}
    title="สมัครบัญชีผู้เช่า"
  >
    <TenantRegistrationForm />
  </AuthPageLayout>;
}
