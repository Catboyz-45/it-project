import { redirect } from "next/navigation";
import { LegalAcceptanceForm } from "@/components/legal/LegalAcceptanceForm";
import { PlatformBrand } from "@/components/ui/PlatformBrand";
import { getPageAuth } from "@/lib/server/auth";
import { hasAcceptedRequiredPolicies } from "@/lib/server/legal-policies";

/** หน้ายืนยันสำหรับบัญชีที่ถูกสร้างจากระบบหลังบ้านหรือบัญชีเดิมก่อนมีระบบนโยบาย */
export default async function AcceptPoliciesPage() {
  const auth = await getPageAuth();
  if (!auth) redirect("/login");
  if (auth.mustChangePassword) redirect("/change-password");
  const roleHome = auth.role === "SUPER_ADMIN" ? "/super-admin" : auth.role === "TENANT" ? "/tenant" : "/admin";
  if (await hasAcceptedRequiredPolicies(auth.userId)) redirect(roleHome);
  return <main className="legal-gate-shell">
    <section className="legal-gate-card">
      <PlatformBrand imageClassName="size-14" showTagline />
      <div><p className="legal-eyebrow">ก่อนเริ่มใช้งาน</p><h1>ข้อตกลงและความเป็นส่วนตัว</h1><p>โปรดอ่านเอกสารเวอร์ชันปัจจุบัน ระบบจะบันทึกเวอร์ชันและเวลาที่คุณยืนยันไว้เป็นหลักฐาน</p></div>
      <LegalAcceptanceForm redirectTo={roleHome} />
    </section>
  </main>;
}
