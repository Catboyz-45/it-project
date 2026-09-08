"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Super Admin Navigation” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  CreditCard,
  Crown,
  LayoutDashboard,
  UsersRound,
} from "lucide-react";

const items = [
  { href: "/super-admin", label: "แดชบอร์ด", icon: LayoutDashboard, exact: true },
  { href: "/super-admin/accounts", label: "บัญชีเจ้าของหอ", icon: UsersRound, exact: false },
  { href: "/super-admin/properties", label: "หอพัก", icon: Building2, exact: false },
  { href: "/super-admin/plans", label: "แพ็กเกจ", icon: Crown, exact: false },
  { href: "/super-admin/subscriptions", label: "การชำระสมาชิก", icon: CreditCard, exact: false },
  { href: "/super-admin/audit-logs", label: "Audit Log", icon: Activity, exact: false },
] as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Super Admin Navigation” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SuperAdminNavigation() {
  const pathname = usePathname();

  return <nav aria-label="เมนู Super Admin" className="super-admin-navigation grid gap-1">
    {items.map(({ exact, href, icon: Icon, label }) => {
      const active = exact ? pathname === href : pathname.startsWith(href);
      return <Link
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
          active ? "bg-brand text-[#fff] shadow-lg shadow-brand/20" : "text-[#62636b] hover:bg-brand/10 hover:text-[#4651c7]"
        }`}
        href={href}
        key={href}
      >
        <Icon size={18} />
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}
