/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React site-shell ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, Menu, Phone, X } from "lucide-react";
import { Logo } from "./logo";
import { companyPublicConfig as fallbackCompany } from "@/lib/public-config";

type ShellCompany = { phoneDisplay?: string | null; phoneHref?: string | null; lineLabel?: string | null; lineUrl?: string | null; businessHours?: string | null };

const links = [
  ["/", "หน้าแรก"], ["/about", "เกี่ยวกับเรา"], ["/services", "บริการ"],
  ["/products", "สินค้า"], ["/projects", "ผลงาน"], ["/news", "ข่าวสาร"], ["/contact", "ติดต่อเรา"],
] as const;

/** สร้างส่วนหน้าจอ SiteHeader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function SiteHeader() {
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
  return (
    <><header className="site-header">
      <nav className="container nav" aria-label="เมนูหลัก">
        <Link href="/" aria-label="อยู่เย็นเป็นสุข วิศวกรรม หน้าแรก"><Logo /></Link>
        <div className="nav-links">
          {links.map(([href, label]) => <Link key={href} href={href} style={{ color: pathname === href ? "var(--green-700)" : undefined }}>{label}</Link>)}
        </div>
        <Link className="btn btn-primary" href="/contact"><Phone size={16} /> ติดต่อเรา</Link>
        <button ref={triggerRef} className="btn btn-outline mobile-nav" type="button" aria-expanded={isOpen} aria-controls="mobile-menu" onClick={() => setIsOpen(true)} aria-label="เปิดเมนู"><Menu size={20} /></button>
      </nav>
    </header>{isOpen && <><button className="drawer-backdrop" aria-label="ปิดเมนู" onClick={() => setIsOpen(false)} /><aside ref={drawerRef} className="drawer" id="mobile-menu" role="dialog" aria-modal="true" aria-label="เมนูหลักบนมือถือ"><div className="drawer-header"><Logo /><button ref={closeButtonRef} className="icon-btn" onClick={() => setIsOpen(false)} aria-label="ปิดเมนู"><X size={22} /></button></div><nav className="drawer-nav">{links.map(([href, label]) => <Link onClick={() => setIsOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`drawer-link ${pathname === href ? "active" : ""}`} key={href} href={href}>{label}<ChevronRight size={17} /></Link>)}</nav><div className="drawer-footer"><Link onClick={() => setIsOpen(false)} className="btn btn-primary" style={{ width: "100%" }} href="/contact"><Phone size={17} /> ติดต่อเรา</Link></div></aside></>}</>
  );
}

/** สร้างส่วนหน้าจอ SiteFooter; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function SiteFooter({ company }: { company?: ShellCompany | null }) {
  const value = { phoneDisplay: company?.phoneDisplay ?? fallbackCompany.phoneDisplay, phoneHref: company?.phoneHref ?? fallbackCompany.phoneHref, lineLabel: company?.lineLabel ?? fallbackCompany.lineLabel, lineUrl: company?.lineUrl ?? fallbackCompany.lineUrl, businessHours: company?.businessHours ?? fallbackCompany.businessHours };
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack"><Logo inverse /><p style={{ maxWidth: 340 }}>ดูแลทุกเรื่องระบบปรับอากาศและงานวิศวกรรม ด้วยบริการที่ตรงไปตรงมาและใส่ใจในระยะยาว</p></div>
          <div><h3>บริษัท</h3><div className="footer-links"><Link href="/about">เกี่ยวกับเรา</Link><Link href="/projects">ผลงานของเรา</Link><Link href="/news">ข่าวสาร</Link></div></div>
          <div><h3>บริการ</h3><div className="footer-links"><Link href="/services">ติดตั้งเครื่องปรับอากาศ</Link><Link href="/services">ล้างและบำรุงรักษา</Link><Link href="/services">งานระบบ M&E</Link></div></div>
          <div><h3>ติดต่อ</h3><div className="footer-links"><a href={`tel:${value.phoneHref}`}>โทร {value.phoneDisplay}</a>{value.lineUrl ? <a href={value.lineUrl} target="_blank" rel="noreferrer">LINE {value.lineLabel}</a> : <span>LINE {value.lineLabel} (รอยืนยัน)</span>}<span>{value.businessHours}</span></div></div>
        </div>
        <div className="footer-bottom"><span>© 2026 อยู่เย็นเป็นสุข วิศวกรรม จำกัด</span><span>ข้อมูลตัวอย่างสำหรับการพัฒนาระบบ</span></div>
      </div>
    </footer>
  );
}

/** สร้างส่วนหน้าจอ PublicShell; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function PublicShell({ children, company }: { children: React.ReactNode; company?: ShellCompany | null }) {
  const pathname = usePathname();
  return <><a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a><span className="sr-only" role="status" aria-live="polite">เปิดหน้า {pathname}</span><SiteHeader /><main id="main-content" tabIndex={-1}>{children}</main><SiteFooter company={company} /></>;
}

/** สร้างส่วนหน้าจอ SectionLink; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="btn btn-outline" href={href}>{children}<ArrowRight size={17} /></Link>;
}
