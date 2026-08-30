/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React admin-shell ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Boxes, BriefcaseBusiness, Building2, ChevronRight, FileText, Image, LayoutDashboard, Menu, Newspaper, Package, Settings, ShieldCheck, Tags, Trash2, Users, X } from "lucide-react";
import { Logo } from "./logo";
import { LogoutButton } from "./logout-button";

const nav = [
  ["/admin", "ภาพรวม", LayoutDashboard],
  ["/admin/company", "ข้อมูลบริษัท", Building2],
  ["/admin/banners", "แบนเนอร์", Image],
  ["/admin/services", "บริการ", BriefcaseBusiness],
  ["/admin/products", "สินค้า", Package],
  ["/admin/projects", "ผลงาน", Boxes],
  ["/admin/news", "ข่าวสาร", Newspaper],
  ["/admin/taxonomies/news-categories", "หมวดหมู่", Tags],
  ["/admin/admins", "ผู้ดูแลระบบ", Users],
  ["/admin/audit", "ประวัติการทำงาน", FileText],
  ["/admin/trash", "ถังขยะ", Trash2],
] as const;

type ShellUser = { displayName: string; username: string; role: "SUPER_ADMIN" | "EDITOR" };

/** สร้างส่วนหน้าจอ AdminShell; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AdminShell({ children, user }: { children: React.ReactNode; user: ShellUser }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", closeOnEscape); trigger?.focus(); };
  }, [isOpen]);

  const roleLabel = user.role === "SUPER_ADMIN" ? "Super Admin" : "Editor";
  const initial = user.displayName.trim().charAt(0) || user.username.charAt(0).toUpperCase();

  return <div className="admin-body">
    <a className="skip-link" href="#admin-content">ข้ามไปยังเนื้อหาหลัก</a>
    <span className="sr-only" role="status" aria-live="polite">เปิดหน้า {pathname}</span>
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/admin"><Logo inverse /></Link>
        <nav className="sidebar-nav" aria-label="เมนูระบบจัดการ">{nav.map(([href, label, Icon]) => <Link key={href} aria-current={pathname === href ? "page" : undefined} className={`sidebar-link ${pathname === href ? "active" : ""}`} href={href}><Icon size={18} /><span>{label}</span></Link>)}</nav>
        <div className="sidebar-account-row"><Link className="sidebar-user" href="/admin/account" aria-label="ตั้งค่าบัญชี"><span className="avatar">{initial}</span><span className="sidebar-user-copy"><strong>{user.displayName}</strong><small>{roleLabel}</small></span></Link><LogoutButton danger /></div>
      </aside>
      <div className="admin-main">
        <header className="mobile-only-admin-nav"><button ref={triggerRef} className="icon-btn" onClick={() => setIsOpen(true)} aria-expanded={isOpen} aria-controls="admin-mobile-menu" aria-label="เปิดเมนู"><Menu size={20} /></button></header>
        <main id="admin-content" tabIndex={-1} className="admin-content">{children}</main>
      </div>
    </div>
    {isOpen && <><button className="drawer-backdrop" aria-label="ปิดเมนู" onClick={() => setIsOpen(false)} /><aside ref={drawerRef} className="drawer" id="admin-mobile-menu" role="dialog" aria-modal="true" aria-label="เมนูระบบจัดการบนมือถือ"><div className="drawer-header"><Logo /><button ref={closeButtonRef} className="icon-btn" onClick={() => setIsOpen(false)} aria-label="ปิดเมนู"><X size={22} /></button></div><nav className="drawer-nav">{nav.map(([href, label, Icon]) => <Link onClick={() => setIsOpen(false)} key={href} aria-current={pathname === href ? "page" : undefined} className={`drawer-link ${pathname === href ? "active" : ""}`} href={href}><span className="cluster"><Icon size={18} />{label}</span><ChevronRight size={17} /></Link>)}</nav><div className="drawer-footer"><div className="drawer-account"><span className="avatar">{initial}</span><div><strong>{user.displayName}</strong><div className="muted">{roleLabel}</div></div></div><Link className="account-action" href="/admin/account" onClick={() => setIsOpen(false)}><Settings size={17} /> ตั้งค่าบัญชี</Link><LogoutButton labeled /></div></aside></>}
  </div>;
}

/** สร้างส่วนหน้าจอ AdminPageHeader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="admin-head"><div><h1 className="admin-title">{title}</h1><p className="admin-subtitle">{description}</p></div>{action}</div>; }

/** สร้างส่วนหน้าจอ SecurityNote; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function SecurityNote() { return <div className="cluster" style={{ color: "var(--green-700)", fontSize: ".78rem", fontWeight: 700 }}><ShieldCheck size={16} /> การทำรายการสำคัญจะถูกบันทึกในประวัติระบบ</div>; }
