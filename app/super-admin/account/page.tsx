
import { BasicAccountPanel } from "@/components/account/BasicAccountPanel";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { requirePageAuth } from "@/lib/server/auth";

// หน้าบัญชีของซูเปอร์แอดมินเอง ใช้แผงเดียวกับของเจ้าของหอและผู้เช่า
export default async function SuperAdminAccountPage() {
  // ดึงชื่อกับอีเมลจากเซสชันฝั่งเซิร์ฟเวอร์ ไม่รับมาจากฝั่งเบราว์เซอร์
  const auth = await requirePageAuth();
  return <>
    <SuperAdminPageHeader description="จัดการข้อมูลบัญชี รหัสผ่าน และความปลอดภัยของคุณ" title="บัญชีของฉัน" />
    <section className="super-admin-account-page">
      <BasicAccountPanel displayName={auth.displayName} email={auth.email} />
    </section>
  </>;
}
