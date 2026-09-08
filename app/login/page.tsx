/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /login ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { redirect } from "next/navigation";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { getPageAuth } from "@/lib/server/auth";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Login Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { searchParams }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if ("email" in query || "password" in query) redirect("/login");
  const auth = await getPageAuth();
  if (auth) redirect(auth.mustChangePassword ? "/change-password" : auth.role === "SUPER_ADMIN" ? "/super-admin" : auth.role === "TENANT" ? "/tenant" : "/admin");
  // Test-view environments use their own seeded accounts. Do not leak the
  // unrelated local demo credentials when Next.js reloads values from .env.
  const isTestDatabase = (() => {
    try {
      return /test/i.test(new URL(process.env.DATABASE_URL ?? "").pathname);
    } catch {
      return false;
    }
  })();
  const showDemoCredentials = process.env.SHOW_DEMO_CREDENTIALS === "true"
    && process.env.NODE_ENV !== "production"
    && !isTestDatabase;
  const demoAccounts = showDemoCredentials ? [
    { label: "แอดมินใหญ่", email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "", password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "" },
    { label: "แอดมินประจำหอ", email: process.env.DEMO_PROPERTY_ADMIN_EMAIL ?? "", password: process.env.DEMO_PROPERTY_ADMIN_PASSWORD ?? "" },
  ].filter((account) => account.email && account.password) : [];

  return <AuthPageLayout
    description="กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่พื้นที่จัดการของคุณ"
    footer={<>เป็นผู้เช่าใหม่? <a href="/register">สมัครด้วยรหัสเชิญ</a></>}
    title="เข้าสู่ระบบ"
  >
    <LoginForm demoAccounts={demoAccounts} />
  </AuthPageLayout>;
}
