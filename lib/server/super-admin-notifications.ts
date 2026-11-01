import { getDatabase } from "@/lib/server/db";
import { countSuperAdminUnreadSupportMessages } from "@/lib/server/chat";

export type SuperAdminNotificationCounts = {
  pendingAccounts: number;
  pendingSubscriptionPayments: number;
  unreadSupportMessages: number;
  expiringSubscriptions: number;
};

// งานค้างของแอดมินใหญ่ ใช้กับกระดิ่งและป้ายตัวเลขบนเมนู
// นับเฉพาะเรื่องที่ต้องลงมือทำ ตัวเลขจะลดเมื่อจัดการเสร็จ ไม่ใช่เมื่อกดเปิดดู ยกเว้นข้อความที่ลดเมื่ออ่าน
export async function getSuperAdminNotificationCounts(): Promise<SuperAdminNotificationCounts> {
  const now = new Date();
  const [pendingAccounts, pendingSubscriptionPayments, unreadSupportMessages, expiringSubscriptions] = await Promise.all([
    // บัญชีเจ้าของหอที่สมัครเข้ามาแล้วรออนุมัติ บัญชีอื่นไม่ต้องผ่านแอดมินใหญ่
    getDatabase().user.count({ where: { role: "PROPERTY_ADMIN", approvalStatus: "PENDING" } }),
    getDatabase().subscriptionPayment.count({ where: { status: "PENDING_REVIEW" } }),
    countSuperAdminUnreadSupportMessages(),
    // เงื่อนไขเดียวกับการ์ด "แพ็กเกจใกล้หมดอายุ" บนแดชบอร์ด กระดิ่งกับแดชบอร์ดจะได้ไม่ขัดกัน
    getDatabase().propertySubscription.count({ where: {
      property: { isActive: true },
      status: "ACTIVE",
      expiresAt: { gt: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
    } }),
  ]);
  return { pendingAccounts, pendingSubscriptionPayments, unreadSupportMessages, expiringSubscriptions };
}
