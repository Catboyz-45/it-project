
import { redirect } from "next/navigation";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { getPageAuth } from "@/lib/server/auth";

// หน้าเข้าสู่ระบบ ตัวฟอร์มเป็น Client Component ส่วนไฟล์นี้ทำหน้าที่เช็คและเตรียมค่าฝั่งเซิร์ฟเวอร์
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  // มีคนส่งรหัสผ่านมาทาง URL ก็ล้างทิ้งทันที ค่าใน URL ติดอยู่ในประวัติเบราว์เซอร์และ log ของเซิร์ฟเวอร์
  if ("email" in query || "password" in query) redirect("/login");
  // ล็อกอินอยู่แล้วไม่ต้องล็อกอินซ้ำ แต่ถ้ายังติดธงเปลี่ยนรหัสต้องไปด่านนั้นก่อน
  const auth = await getPageAuth();
  if (auth) redirect(auth.mustChangePassword ? "/change-password" : auth.role === "SUPER_ADMIN" ? "/super-admin" : auth.role === "TENANT" ? "/tenant" : "/admin");
  // ฐานทดสอบมีบัญชีของตัวเอง ถ้าไม่กันไว้ Next จะอ่านค่าเดโมจาก .env มาโชว์ผิดชุด
  const isTestDatabase = (() => {
    try {
      return /test/i.test(new URL(process.env.DATABASE_URL ?? "").pathname);
    } catch {
      return false;
    }
  })();
  // ต้องผ่านครบสามเงื่อนไขถึงจะโชว์บัญชีทดลอง บนโปรดักชันไม่มีทางขึ้น
  const showDemoCredentials = process.env.SHOW_DEMO_CREDENTIALS === "true"
    && process.env.NODE_ENV !== "production"
    && !isTestDatabase;
  const demoAccounts = showDemoCredentials ? [
    { label: "แอดมินใหญ่", email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? "", password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "" },
    { label: "แอดมินประจำหอ", email: process.env.DEMO_PROPERTY_ADMIN_EMAIL ?? "", password: process.env.DEMO_PROPERTY_ADMIN_PASSWORD ?? "" },
  // กรองอันที่ตั้งค่าไม่ครบทิ้ง จะได้ไม่ขึ้นปุ่มที่กดแล้วล็อกอินไม่ได้
  ].filter((account) => account.email && account.password) : [];

  return <AuthPageLayout
    description="กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่พื้นที่จัดการของคุณ"
    footer={<>เป็นผู้เช่าใหม่? <a href="/register">สมัครด้วยรหัสเชิญ</a></>}
    title="เข้าสู่ระบบ"
  >
    <LoginForm demoAccounts={demoAccounts} />
  </AuthPageLayout>;
}
