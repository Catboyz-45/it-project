import { getDatabase } from "@/lib/server/db";
import { countSuperAdminUnreadSupportMessages } from "@/lib/server/chat";

export type SuperAdminNotificationCounts = {
  pendingAccounts: number;
  pendingSubscriptionPayments: number;
  unreadSupportMessages: number;
};

// งานค้างของแอดมินใหญ่ ใช้กับกระดิ่งและป้ายตัวเลขบนเมนู
// นับเฉพาะเรื่องที่ต้องลงมือทำ ตัวเลขจะลดเมื่อจัดการเสร็จ ไม่ใช่เมื่อกดเปิดดู ยกเว้นข้อความที่ลดเมื่ออ่าน
export async function getSuperAdminNotificationCounts(): Promise<SuperAdminNotificationCounts> {
  const [pendingAccounts, pendingSubscriptionPayments, unreadSupportMessages] = await Promise.all([
    // บัญชีเจ้าของหอที่สมัครเข้ามาแล้วรออนุมัติ บัญชีอื่นไม่ต้องผ่านแอดมินใหญ่
    getDatabase().user.count({ where: { role: "PROPERTY_ADMIN", approvalStatus: "PENDING" } }),
    getDatabase().subscriptionPayment.count({ where: { status: "PENDING_REVIEW" } }),
    countSuperAdminUnreadSupportMessages(),
  ]);
  return { pendingAccounts, pendingSubscriptionPayments, unreadSupportMessages };
}
