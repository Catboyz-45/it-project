"use client";
// เก็บสถานะเปิดปิดเมนู และดักคลิกนอกเมนูจาก document

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { AccountChip, type AccountRoleTone } from "@/components/ui/AccountChip";
import { useEffect, useRef, useState } from "react";
import { useLogout } from "@/lib/client/use-logout";

// เมนูนี้ใช้ได้สองฝั่ง ผู้เช่ากับผู้ดูแลระบบ
type SidebarAccountRole = "TENANT" | "SUPER_ADMIN";

// รวมข้อความและลิงก์ของแต่ละฝั่งไว้ที่เดียว จะได้ไม่ต้องเขียน if กระจายทั้งไฟล์
const roleConfig: Record<SidebarAccountRole, {
  accountHref: string;
  accountLabel: string;
  context: string;
  roleLabel: string;
  tone: AccountRoleTone;
}> = {
  TENANT: {
    accountHref: "/tenant/account",
    accountLabel: "บัญชีและความปลอดภัย",
    context: "พื้นที่ผู้เช่า",
    roleLabel: "ผู้เช่า",
    tone: "tenant",
  },
  SUPER_ADMIN: {
    accountHref: "/super-admin/account",
    accountLabel: "บัญชีและความปลอดภัย",
    context: "Nestly Control",
    roleLabel: "ผู้ดูแลระบบ",
    tone: "admin",
  },
};

// ปุ่มบัญชีท้ายแถบข้าง กดแล้วเด้งเมนูขึ้นมาให้ไปหน้าบัญชีหรือออกจากระบบ
export function SidebarAccountMenu({
  // ส่งมาแทน context เริ่มต้นได้ เช่นอยากโชว์ชื่อหอพักที่กำลังดูอยู่
  contextLabel,
  displayName,
  email,
  role,
  roleLabel,
}: Readonly<{
  contextLabel?: string;
  displayName: string;
  email: string;
  role: SidebarAccountRole;
  // แทนป้ายบทบาทเริ่มต้นได้ เช่นผู้พักร่วมที่เป็นบัญชีผู้เช่าเหมือนกันแต่สิทธิ์ไม่เท่าผู้เช่าหลัก
  roleLabel?: string;
}>) {
  const pathname = usePathname();
  const config = roleLabel ? { ...roleConfig[role], roleLabel } : roleConfig[role];
  const [isOpen, setIsOpen] = useState(false);
  const { isLoggingOut, logout } = useLogout();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ผูก listener เฉพาะตอนเมนูเปิด ปิดแล้วไม่ต้องไปกวน event ของทั้งหน้า
    if (!isOpen) return;

    // คลิกที่ไหนก็ได้นอกกล่องแล้วปิด เป็นพฤติกรรมที่คนคาดหวังจากเมนูแบบนี้
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    // Esc ปิดเมนู สำหรับคนที่ใช้คีย์บอร์ดอย่างเดียว
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    // pointerdown ไม่ใช่ click เพื่อให้เมนูปิดตั้งแต่กดลง ไม่ต้องรอปล่อยนิ้ว
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return <div className="sidebar-footer sidebar-account-footer" ref={containerRef}>
    {isOpen ? <div className="account-menu" role="menu">
      {/* บอกว่ากำลังใช้งานในฐานะใคร กันสับสนตอนมีหลายบัญชี */}
      <p>
        <strong>{contextLabel || config.context}</strong>
        <span>{displayName}</span>
        <small>{email}</small>
      </p>
      <Link href={config.accountHref} onClick={() => setIsOpen(false)} role="menuitem">
        <ShieldCheck aria-hidden="true" size={18} />
        {config.accountLabel}
      </Link>
      {/* เส้นคั่นที่วาดด้วย CSS กันเผลอกดออกจากระบบตอนตั้งใจจะกดเมนูข้างบน */}
      <span />
      <button className="danger" disabled={isLoggingOut} onClick={() => void logout()} role="menuitem" type="button">
        <LogOut aria-hidden="true" size={18} />
        {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
      </button>
    </div> : null}
    <button
      // บอกโปรแกรมอ่านหน้าจอว่าปุ่มนี้เปิดเมนู และตอนนี้เปิดอยู่หรือยัง
      aria-expanded={isOpen}
      aria-haspopup="menu"
      aria-label={`เปิดเมนูบัญชี ${displayName} ${config.roleLabel}`}
      // ไฮไลต์ไว้เมื่อกำลังอยู่หน้าบัญชีอยู่แล้ว
      className={`account-chip-trigger${pathname === config.accountHref ? " active" : ""}`}
      onClick={() => setIsOpen((current) => !current)}
      type="button"
    >
      <AccountChip context={role === "TENANT" ? contextLabel : undefined} name={displayName} roleLabel={config.roleLabel} tone={config.tone} />
    </button>
  </div>;
}
