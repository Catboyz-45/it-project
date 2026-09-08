"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Sidebar Account Menu” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Sidebar Account Role” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type SidebarAccountRole = "TENANT" | "SUPER_ADMIN";

const roleConfig: Record<SidebarAccountRole, {
  accountHref: string;
  accountLabel: string;
  context: string;
  triggerLabel: string;
}> = {
  TENANT: {
    accountHref: "/tenant/account",
    accountLabel: "บัญชีและความปลอดภัย",
    context: "พื้นที่ผู้เช่า",
    triggerLabel: "บัญชีของฉัน",
  },
  SUPER_ADMIN: {
    accountHref: "/super-admin/account",
    accountLabel: "บัญชีและความปลอดภัย",
    context: "Nestly Control",
    triggerLabel: "บัญชีผู้ดูแลระบบ",
  },
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Sidebar Account Menu” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { contextLabel, displayName, email, role, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SidebarAccountMenu({
  contextLabel,
  displayName,
  email,
  role,
}: {
  contextLabel?: string;
  displayName: string;
  email: string;
  role: SidebarAccountRole;
}) {
  const pathname = usePathname();
  const config = roleConfig[role];
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Outside Click” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Escape” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “logout” ตามกฎของระบบ
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json() as { redirectTo?: string };
      window.location.assign(result.redirectTo || "/login");
    } catch {
      setIsLoggingOut(false);
    }
  };

  return <div className="sidebar-footer sidebar-account-footer" ref={containerRef}>
    {isOpen ? <div className="account-menu" role="menu">
      <p>
        <strong>{contextLabel || config.context}</strong>
        <span>{displayName}</span>
        <small>{email}</small>
      </p>
      <Link href={config.accountHref} onClick={() => setIsOpen(false)} role="menuitem">
        <ShieldCheck aria-hidden="true" size={18} />
        {config.accountLabel}
      </Link>
      <span />
      <button className="danger" disabled={isLoggingOut} onClick={() => void logout()} role="menuitem" type="button">
        <LogOut aria-hidden="true" size={18} />
        {isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
      </button>
    </div> : null}
    <button
      aria-expanded={isOpen}
      aria-haspopup="menu"
      aria-label="เปิดเมนูบัญชี"
      className={pathname === config.accountHref ? "active" : ""}
      onClick={() => setIsOpen((current) => !current)}
      type="button"
    >
      <UserRound aria-hidden="true" size={18} />
      <span className="min-w-0 flex-1 truncate text-left">{config.triggerLabel}</span>
    </button>
  </div>;
}
