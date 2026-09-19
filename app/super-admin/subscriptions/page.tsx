
import { SuperAdminForms } from "@/components/admin/SuperAdminForms";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SubscriptionPaymentReview } from "@/components/admin/SubscriptionPaymentReview";

// หน้าตรวจการชำระค่าสมาชิก แยกสองส่วน ข้างบนคือคิวรอตรวจ ข้างล่างคือฟอร์มแก้สถานะด้วยมือ
export default function SuperAdminSubscriptionsPage() {
  return <>
    <SuperAdminPageHeader
      description="ตรวจหลักฐานการชำระ เปิดใช้หรือต่ออายุสมาชิก และช่วยแก้สถานะแพ็กเกจเมื่อจำเป็น"
      title="การชำระสมาชิก"
    />
    <SubscriptionPaymentReview />
    <SuperAdminForms sections={["subscription"]} />
  </>;
}
