import { redirect } from "next/navigation";
import { LegalAcceptanceForm } from "@/components/legal/LegalAcceptanceForm";
import { PlatformBrand } from "@/components/ui/PlatformBrand";
import { getPageAuth } from "@/lib/server/auth";
import { hasAcceptedRequiredPolicies } from "@/lib/server/legal-policies";
import { roleHomePath } from "@/lib/navigation-routes";

// ด่านให้กดยอมรับนโยบาย สำหรับบัญชีที่แอดมินสร้างให้ หรือบัญชีเก่าที่มีก่อนระบบนโยบาย
export default async function AcceptPoliciesPage() {
  const auth = await getPageAuth();
  // ยังไม่ได้ล็อกอินก็ไม่มีอะไรให้บันทึกว่าใครยอมรับ
  if (!auth) redirect("/login");
  // เปลี่ยนรหัสชั่วคราวมาก่อน ไม่งั้นจะติดสองด่านพร้อมกันแล้ววนไปมา
  if (auth.mustChangePassword) redirect("/change-password");
  const roleHome = roleHomePath(auth.role);
  // ยอมรับครบแล้วก็ไม่ต้องถามซ้ำ ส่งกลับหน้าแรกตามบทบาทเลย
  if (await hasAcceptedRequiredPolicies(auth.userId)) redirect(roleHome);
  return <main className="legal-gate-shell">
    <section className="legal-gate-card">
      <PlatformBrand imageClassName="size-14" showTagline />
      <div><p className="legal-eyebrow">ก่อนเริ่มใช้งาน</p><h1>ข้อตกลงและความเป็นส่วนตัว</h1><p>โปรดอ่านเอกสารเวอร์ชันปัจจุบัน ระบบจะบันทึกเวอร์ชันและเวลาที่คุณยืนยันไว้เป็นหลักฐาน</p></div>
      <LegalAcceptanceForm redirectTo={roleHome} />
    </section>
  </main>;
}
