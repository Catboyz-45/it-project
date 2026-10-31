"use client";
// ตัวเลขแจ้งเตือนของแอดมินใหญ่ ใช้ร่วมกันระหว่างกระดิ่ง ป้ายบนเมนู และหน้าต่างแชท
// layout ส่งค่าตั้งต้นมาจากเซิร์ฟเวอร์ แล้วฝั่งเบราว์เซอร์โหลดใหม่เองเมื่อเปลี่ยนหน้าหรือกลับมาที่แท็บ

import { CreditCard, MessageSquare, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NotificationCenter, type NotificationCenterItem } from "@/components/ui/NotificationCenter";
import { useRefreshOnFocus } from "@/lib/client/use-refresh-on-focus";
import type { SuperAdminNotificationCounts } from "@/lib/server/super-admin-notifications";

type SuperAdminNotificationsValue = {
  // ตัวเลขที่เพิ่มขึ้นเพื่อสั่งให้หน้าต่างแชทเปิด ใช้ตัวเลขเพราะสั่งเปิดซ้ำได้เรื่อย ๆ
  chatOpenSignal: number;
  counts: SuperAdminNotificationCounts;
  isRefreshing: boolean;
  openChat: () => void;
  refresh: () => Promise<void>;
};

const SuperAdminNotificationsContext = createContext<SuperAdminNotificationsValue | null>(null);

export function useSuperAdminNotifications() {
  return useContext(SuperAdminNotificationsContext);
}

export function SuperAdminNotificationsProvider({ children, initialCounts }: Readonly<{
  children: ReactNode;
  initialCounts: SuperAdminNotificationCounts;
}>) {
  const pathname = usePathname();
  const [counts, setCounts] = useState(initialCounts);
  const [chatOpenSignal, setChatOpenSignal] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // ค่าตั้งต้นเพิ่งมาจากเซิร์ฟเวอร์ รอบแรกจึงไม่ต้องถามซ้ำ
  const skipFirstRefreshRef = useRef(true);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/v1/super-admin/notifications", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json() as { data?: SuperAdminNotificationCounts };
      if (response.ok && payload.data) setCounts(payload.data);
    } catch {
      // ตัวเลขโหลดไม่ได้ก็คงค่าเดิมไว้ ไม่ควรขึ้นข้อผิดพลาดใหญ่ของทั้งหน้า
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // layout ไม่ render ใหม่ตอนเปลี่ยนหน้าลูก จึงโหลดเองทุกครั้งที่เปลี่ยนหน้า งานที่เพิ่งจัดการไปจะได้ลดตาม
  useEffect(() => {
    if (skipFirstRefreshRef.current) {
      skipFirstRefreshRef.current = false;
      return;
    }
    void refresh();
  }, [pathname, refresh]);
  useRefreshOnFocus(refresh);

  const openChat = useCallback(() => setChatOpenSignal((current) => current + 1), []);
  const value = useMemo(
    () => ({ chatOpenSignal, counts, isRefreshing, openChat, refresh }),
    [chatOpenSignal, counts, isRefreshing, openChat, refresh],
  );

  return <SuperAdminNotificationsContext.Provider value={value}>{children}</SuperAdminNotificationsContext.Provider>;
}

// กระดิ่งบนหัวหน้าของแอดมินใหญ่ งานค้างลดเมื่อจัดการเสร็จ ส่วนข้อความลดเมื่อเปิดอ่าน
export function SuperAdminNotificationBell() {
  const context = useSuperAdminNotifications();
  if (!context) return null;
  const { counts, isRefreshing, openChat, refresh } = context;
  const items: NotificationCenterItem[] = [
    { id: "pending-accounts", count: counts.pendingAccounts, title: "บัญชีเจ้าของหอรออนุมัติ", description: "ตรวจสอบข้อมูลผู้สมัครแล้วอนุมัติหรือปฏิเสธบัญชี", href: "/super-admin/accounts", icon: <UsersRound size={19} /> },
    { id: "pending-subscription-payments", count: counts.pendingSubscriptionPayments, title: "หลักฐานค่าสมาชิกรอตรวจสอบ", description: "ตรวจสลิปแล้วอนุมัติหรือปฏิเสธการชำระค่าสมาชิก", href: "/super-admin/subscriptions", icon: <CreditCard size={19} /> },
    { id: "support-messages", count: counts.unreadSupportMessages, title: "ข้อความใหม่จากเจ้าของหอ", description: "เปิดกล่องข้อความเพื่อตอบคำถามการใช้งานระบบ", onSelect: openChat, icon: <MessageSquare size={19} /> },
  ];
  return <NotificationCenter isLoading={isRefreshing} items={items} onRefresh={refresh} storageKey="super-admin-notifications" />;
}
