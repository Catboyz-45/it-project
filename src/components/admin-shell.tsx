"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Boxes, BriefcaseBusiness, Building2, ChevronRight, FileText, Image, LayoutDashboard, Menu, Newspaper, Package, Settings, ShieldCheck, Tags, Trash2, Users, X } from "lucide-react";
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setIsOpen(false); return; } if (event.key !== "Tab") return; const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'); if (!focusable?.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", closeOnEscape); trigger?.focus(); };
  }, [isOpen]);
  return <div className="admin-body"><a className="skip-link" href="#admin-content">ข้ามไปยังเนื้อหาหลัก</a><span className="sr-only" role="status" aria-live="polite">เปิดหน้า {pathname}</span><div className="admin-shell"><aside className="sidebar"><Link href="/admin"><Logo inverse /></Link><nav className="sidebar-nav" aria-label="เมนูระบบจัดการ">{nav.map(([href, label, Icon]) => <Link key={href} aria-current={pathname === href ? "page" : undefined} className={`sidebar-link ${pathname === href ? "active" : ""}`} href={href}><Icon size={18} /><span>{label}</span></Link>)}</nav><div className="sidebar-user"><span className="avatar">ส</span><div><strong style={{ color: "white", fontSize: ".8rem" }}>เจ้าของบริษัท</strong><div style={{ fontSize: ".7rem" }}>Super Admin</div></div></div></aside><div className="admin-main"><header className="admin-topbar"><button ref={triggerRef} className="icon-btn" onClick={() => setIsOpen(true)} aria-expanded={isOpen} aria-controls="admin-mobile-menu" aria-label="เปิดเมนู"><Menu size={20} /></button><div className="cluster"><Link className="btn btn-ghost" href="/" target="_blank">ดูเว็บไซต์</Link><button className="icon-btn" aria-label="การแจ้งเตือน"><Bell size={19} /></button><button className="icon-btn" aria-label="ตั้งค่า"><Settings size={19} /></button><LogoutButton /></div></header><main id="admin-content" tabIndex={-1} className="admin-content">{children}</main></div></div>{isOpen && <><button className="drawer-backdrop" aria-label="ปิดเมนู" onClick={() => setIsOpen(false)} /><aside ref={drawerRef} className="drawer" id="admin-mobile-menu" role="dialog" aria-modal="true" aria-label="เมนูระบบจัดการบนมือถือ"><div className="drawer-header"><Logo /><button ref={closeButtonRef} className="icon-btn" onClick={() => setIsOpen(false)} aria-label="ปิดเมนู"><X size={22} /></button></div><nav className="drawer-nav">{nav.map(([href, label, Icon]) => <Link onClick={() => setIsOpen(false)} key={href} aria-current={pathname === href ? "page" : undefined} className={`drawer-link ${pathname === href ? "active" : ""}`} href={href}><span className="cluster"><Icon size={18} />{label}</span><ChevronRight size={17} /></Link>)}</nav><div className="drawer-footer"><div className="cluster"><span className="avatar">ส</span><div><strong>เจ้าของบริษัท</strong><div className="muted" style={{ fontSize: ".75rem" }}>Super Admin</div></div></div></div></aside></>}</div>;
}

export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="admin-head"><div><h1 className="admin-title">{title}</h1><p className="admin-subtitle">{description}</p></div>{action}</div>; }

export function SecurityNote() { return <div className="cluster" style={{ color: "var(--green-700)", fontSize: ".78rem", fontWeight: 700 }}><ShieldCheck size={16} /> การทำรายการสำคัญจะถูกบันทึกในประวัติระบบ</div>; }
