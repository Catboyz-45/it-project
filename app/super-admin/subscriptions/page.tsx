import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { SubscriptionOverrideButton } from "@/components/admin/SubscriptionOverrideForm";
import { SubscriptionPaymentReview, type Payment } from "@/components/admin/SubscriptionPaymentReview";
import { subscriptionPaymentPageSize } from "@/lib/domain/saas";
import { getSubscriptionPaymentSummary, listSubscriptionPayments } from "@/lib/server/subscription-orders";
import { toClientData } from "@/lib/server/client-data";

// หน้าตรวจการชำระค่าสมาชิก การ์ดสรุป ตารางกรองตามสถานะ และแผงสลิป
// การแก้แพ็กเกจด้วยตนเองเป็นปุ่มบนหัวหน้า เปิดเป็นป็อปอัพ ไม่วางเด่นเท่างานตรวจสลิป
export default async function SuperAdminSubscriptionsPage() {
  // layout ตรวจบทบาทไปแล้ว ตรงนี้ดึงคิวรอตรวจหน้าแรกกับตัวเลขสรุปให้มาพร้อม HTML
  // แปลงผ่าน JSON เพราะปกติข้อมูลชุดนี้เดินทางผ่าน API วันที่กับ Decimal จึงถึงหน้าจอเป็นสตริง
  const [pending, summary] = await Promise.all([
    listSubscriptionPayments({ page: 1, pageSize: subscriptionPaymentPageSize }, { status: "PENDING_REVIEW", query: undefined }),
    getSubscriptionPaymentSummary(),
  ]);
  return <>
    <SuperAdminPageHeader
      actions={<SubscriptionOverrideButton />}
      description="ตรวจหลักฐานการชำระ เปิดใช้หรือต่ออายุสมาชิก และช่วยแก้สถานะแพ็กเกจเมื่อจำเป็น"
      title="การชำระสมาชิก"
    />
    <SubscriptionPaymentReview
      initialPageInfo={pending.pageInfo}
      initialPayments={toClientData(pending.data) as Payment[]}
      initialSummary={summary}
    />
  </>;
}
