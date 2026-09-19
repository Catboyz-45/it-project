"use client";
// เก็บสถานะเปิดปิดเมนู และดักคลิกนอกเมนูจาก document

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// เมนูนี้ใช้ได้สองฝั่ง ผู้เช่ากับผู้ดูแลระบบ
type SidebarAccountRole = "TENANT" | "SUPER_ADMIN";

// รวมข้อความและลิงก์ของแต่ละฝั่งไว้ที่เดียว จะได้ไม่ต้องเขียน if กระจายทั้งไฟล์
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

// ปุ่มบัญชีท้ายแถบข้าง กดแล้วเด้งเมนูขึ้นมาให้ไปหน้าบัญชีหรือออกจากระบบ
export function SidebarAccountMenu({
  // ส่งมาแทน context เริ่มต้นได้ เช่นอยากโชว์ชื่อหอพักที่กำลังดูอยู่
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

  const logout = async () => {
    // กันกดซ้ำระหว่างรอเซิร์ฟเวอร์ตอบ จะได้ไม่ยิงลบ session สองรอบ
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      // ต้องเป็น POST เพราะเป็นการเปลี่ยนสถานะ เซิร์ฟเวอร์จะได้ลบ session และล้างคุกกี้
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      // ให้เซิร์ฟเวอร์เป็นคนบอกปลายทาง เพราะแต่ละบทบาทกลับไปคนละหน้า
      const result = await response.json() as { redirectTo?: string };
      // assign ไม่ใช่ router.push เพื่อให้โหลดหน้าใหม่ทั้งหมด ข้อมูลของผู้ใช้เดิมจะได้ไม่ค้างในหน่วยความจำ
      window.location.assign(result.redirectTo || "/login");
    } catch {
      // ต่อเน็ตไม่ติดก็ปลดล็อกปุ่มให้กดใหม่ได้ ไม่ปล่อยค้างว่ากำลังออกจากระบบ
      setIsLoggingOut(false);
    }
  };

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
      aria-label="เปิดเมนูบัญชี"
      // ไฮไลต์ไว้เมื่อกำลังอยู่หน้าบัญชีอยู่แล้ว
      className={pathname === config.accountHref ? "active" : ""}
      onClick={() => setIsOpen((current) => !current)}
      type="button"
    >
      <UserRound aria-hidden="true" size={18} />
      {/* truncate กันชื่อยาวดันปุ่มจนแถบข้างเบี้ยว */}
      <span className="min-w-0 flex-1 truncate text-left">{config.triggerLabel}</span>
    </button>
  </div>;
}
