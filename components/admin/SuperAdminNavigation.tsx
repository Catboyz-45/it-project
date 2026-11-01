"use client";
// ต้องรู้ว่าตอนนี้อยู่หน้าไหน เพื่อไฮไลต์เมนูให้ถูก

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  CreditCard,
  Crown,
  LayoutDashboard,
  Settings,
  UsersRound,
} from "lucide-react";
import { useSuperAdminNotifications } from "@/components/admin/SuperAdminNotifications";
import type { SuperAdminNotificationCounts } from "@/lib/server/super-admin-notifications";

// เก็บเป็นข้อมูล จะได้วนสร้างเมนูได้เลย และเพิ่มหน้าใหม่โดยไม่ต้องแก้ JSX
// exact: true เฉพาะแดชบอร์ด เพราะ /super-admin เป็นคำนำหน้าของทุกหน้าที่เหลือ
const items = [
  { href: "/super-admin", label: "แดชบอร์ด", icon: LayoutDashboard, exact: true },
  { href: "/super-admin/accounts", label: "บัญชีเจ้าของหอ", icon: UsersRound, exact: false, countKey: "pendingAccounts" },
  { href: "/super-admin/properties", label: "หอพัก", icon: Building2, exact: false },
  { href: "/super-admin/plans", label: "แพ็กเกจ", icon: Crown, exact: false },
  { href: "/super-admin/subscriptions", label: "การชำระสมาชิก", icon: CreditCard, exact: false, countKey: "pendingSubscriptionPayments" },
  { href: "/super-admin/audit-logs", label: "บันทึกการใช้งาน", icon: Activity, exact: false },
  { href: "/super-admin/settings", label: "ตั้งค่าระบบ", icon: Settings, exact: false },
] satisfies ReadonlyArray<{
  countKey?: keyof SuperAdminNotificationCounts;
  exact: boolean;
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
}>;

export function SuperAdminNavigation() {
  const pathname = usePathname();
  // ป้ายตัวเลขเป็นงานค้าง ลดเมื่อจัดการเสร็จ ไม่ใช่เมื่อกดเข้าเมนู
  const counts = useSuperAdminNotifications()?.counts;

  return <nav aria-label="เมนู Super Admin" className="super-admin-navigation grid gap-1">
    {items.map((item) => {
      const { exact, href, icon: Icon, label } = item;
      const count = item.countKey && counts ? counts[item.countKey] : 0;
      const active = exact ? pathname === href : pathname.startsWith(href);
      // aria-current บอกโปรแกรมอ่านหน้าจอว่าอยู่หน้านี้ ไม่ใช่แค่ทำให้สีเข้ม
      return <Link
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 lg:min-h-9 ${
          active ? "bg-brand/[.10] font-semibold text-[#4651c7]" : "font-medium text-[#62636b] hover:bg-[#ededee] hover:text-[#292a30]"
        }`}
        href={href}
        key={href}
      >
        <Icon size={18} />
        <span>{label}</span>
        {count > 0 ? <span aria-label={`${count} รายการที่ต้องดำเนินการ`} className="notification-badge">{count > 99 ? "99+" : count}</span> : null}
      </Link>;
    })}
  </nav>;
}
