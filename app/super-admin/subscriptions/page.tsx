
import { SuperAdminForms } from "@/components/admin/SuperAdminForms";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SubscriptionPaymentReview, type Payment } from "@/components/admin/SubscriptionPaymentReview";
import { listPendingSubscriptionPayments } from "@/lib/server/subscription-orders";

// หน้าตรวจการชำระค่าสมาชิก แยกสองส่วน ข้างบนคือคิวรอตรวจ ข้างล่างคือฟอร์มแก้สถานะด้วยมือ
export default async function SuperAdminSubscriptionsPage() {
  // layout ตรวจบทบาทไปแล้ว ตรงนี้ดึงคิวรอตรวจหน้าแรกให้มาพร้อม HTML
  // แปลงผ่าน JSON เพราะปกติข้อมูลชุดนี้เดินทางผ่าน API วันที่กับ Decimal จึงถึงหน้าจอเป็นสตริง
  const pending = await listPendingSubscriptionPayments({ page: 1, pageSize: 20 });
  return <>
    <SuperAdminPageHeader
      description="ตรวจหลักฐานการชำระ เปิดใช้หรือต่ออายุสมาชิก และช่วยแก้สถานะแพ็กเกจเมื่อจำเป็น"
      title="การชำระสมาชิก"
    />
    <SubscriptionPaymentReview
      initialHasNextPage={pending.pageInfo.hasNextPage}
      initialPayments={JSON.parse(JSON.stringify(pending.data)) as Payment[]}
    />
    <SuperAdminForms sections={["subscription"]} />
  </>;
}
