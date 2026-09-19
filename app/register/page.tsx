
import { redirect } from "next/navigation";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { TenantRegistrationForm } from "@/components/auth/TenantRegistrationForm";
import { getPageAuth } from "@/lib/server/auth";

// หน้าสมัครบัญชีผู้เช่า ต้องมีรหัสเชิญจากหอ ระบบจึงไม่เปิดให้ใครก็สมัครเข้าหอได้เอง
export default async function RegisterPage() {
  // ล็อกอินอยู่แล้วไม่ต้องสมัครใหม่ ส่งกลับหน้าแรกตามบทบาท
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
