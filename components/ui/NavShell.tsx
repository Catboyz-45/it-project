"use client";
// เปลือกหน้าที่ใช้ร่วมกันทุกบทบาท ถือสถานะเปิดปิดแถบเมนูข้างไว้ที่เดียว
// คอมพิวเตอร์ ปุ่มแฮมเบอร์เกอร์ย่อแถบเหลือแต่ไอคอน ส่วนมือถือ แถบกลายเป็นลิ้นชักเลื่อนออกจากซ้าย
// แต่ละบทบาทยังวาดแถบข้างของตัวเองเหมือนเดิม แค่ใส่ id="app-sidebar" ให้ปุ่มชี้ไปถูกตัว

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

export const appSidebarId = "app-sidebar";

// ตรงกับ breakpoint มือถือใน globals.css ต่ำกว่านี้แถบข้างเป็นลิ้นชัก
const mobileQuery = "(max-width: 767px)";
// จำว่าย่อแถบไว้หรือไม่ เป็นความสะดวกเฉพาะเครื่อง หายไปก็แค่กลับมากางเหมือนเดิม
const collapsedStorageKey = "nav-collapsed";

type NavShellValue = {
  isMenuVisible: boolean;
  isMobile: boolean;
  toggle: () => void;
};

const NavShellContext = createContext<NavShellValue | null>(null);

function subscribeToMobile(onChange: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(collapsedStorageKey) === "1";
  } catch {
    return false;
  }
}

function storeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(collapsedStorageKey, collapsed ? "1" : "0");
  } catch {
    // โหมดส่วนตัวหรือปิด storage ไว้ ย่อได้ตามปกติแค่จำไม่ได้
  }
}

function focusFirstSidebarItem() {
  document.getElementById(appSidebarId)?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
}

export function NavShell({ children, className }: Readonly<{ children: ReactNode; className: string }>) {
  const pathname = usePathname();
  // ฝั่งเซิร์ฟเวอร์ไม่รู้ขนาดจอ ถือเป็นคอมไว้ก่อน แล้วเบราว์เซอร์ค่อยแก้ให้ตรงหลัง hydrate
  const isMobile = useSyncExternalStore(subscribeToMobile, () => window.matchMedia(mobileQuery).matches, () => false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // เปิด transition หลังผู้ใช้กดเองเท่านั้น ไม่งั้นตอนโหลดหน้าที่จำค่าย่อไว้ แถบจะค่อย ๆ หดให้เห็นทุกครั้ง
  const [hasInteracted, setHasInteracted] = useState(false);
  // จำ pathname ล่าสุดไว้ เปลี่ยนหน้าเมื่อไหร่ก็ปิดลิ้นชักระหว่าง render ไม่ต้องรอ effect
  const [drawerPathname, setDrawerPathname] = useState(pathname);

  if (drawerPathname !== pathname) {
    setDrawerPathname(pathname);
    setIsDrawerOpen(false);
  }

  useEffect(() => {
    // localStorage อ่านได้หลัง mount เท่านั้น อ่านตอน render จะทำให้ HTML ไม่ตรงกับเซิร์ฟเวอร์
    if (readStoredCollapsed()) setIsCollapsed(true);
  }, []);

  const closeDrawer = useCallback((returnFocus: boolean) => {
    setIsDrawerOpen(false);
    if (returnFocus) document.querySelector<HTMLElement>(".nav-toggle-topbar")?.focus();
  }, []);

  useEffect(() => {
    if (!isDrawerOpen || !isMobile) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer(true);
    };
    // ล็อกการเลื่อนหน้าข้างหลังไว้ระหว่างเปิดลิ้นชัก นิ้วเลื่อนจะได้ไม่ไปเลื่อนเนื้อหาที่ถูกบังอยู่
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    focusFirstSidebarItem();
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeDrawer, isDrawerOpen, isMobile]);

  const toggle = useCallback(() => {
    setHasInteracted(true);
    if (isMobile) {
      // ปิดจากปุ่มในลิ้นชักแล้วต้องย้ายโฟกัสออกมาด้วย ไม่งั้นโฟกัสค้างอยู่ในเมนูที่ซ่อนไปแล้ว
      if (isDrawerOpen) closeDrawer(true);
      else setIsDrawerOpen(true);
      return;
    }
    setIsCollapsed((current) => {
      storeCollapsed(!current);
      return !current;
    });
  }, [closeDrawer, isDrawerOpen, isMobile]);

  const isMenuVisible = isMobile ? isDrawerOpen : !isCollapsed;
  const value = useMemo(() => ({ isMenuVisible, isMobile, toggle }), [isMenuVisible, isMobile, toggle]);

  return <NavShellContext.Provider value={value}>
    <main
      className={className}
      data-nav-animate={hasInteracted ? "" : undefined}
      data-nav-collapsed={isCollapsed ? "" : undefined}
      data-nav-open={isDrawerOpen ? "" : undefined}
    >
      {children}
      {/* พื้นหลังมืดเป็นทางปิดสำหรับเมาส์และนิ้วเท่านั้น คีย์บอร์ดใช้ Esc หรือปุ่มแฮมเบอร์เกอร์ในลิ้นชัก */}
      {isMobile && isDrawerOpen ? <div aria-hidden="true" className="nav-backdrop" onClick={() => closeDrawer(false)} /> : null}
    </main>
  </NavShellContext.Provider>;
}

// สามเส้นเท่ากันตอนเมนูซ่อนอยู่ เส้นสั้นลงไล่ระดับตอนเมนูกางอยู่ บอกว่ากดแล้วจะพับเก็บ
function HamburgerIcon({ isMenuVisible }: Readonly<{ isMenuVisible: boolean }>) {
  return <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="22">
    {isMenuVisible
      ? <path d="M4 6h16M9 12h11M14 18h6" />
      : <path d="M4 6h16M4 12h16M4 18h16" />}
  </svg>;
}

// ปุ่มหลักอยู่หัวแถบเมนูข้างโลโก้ ส่วน "topbar" มีไว้เปิดลิ้นชักบนมือถือเท่านั้น
// เพราะตอนลิ้นชักปิด แถบเมนูอยู่นอกจอ ปุ่มในแถบจึงกดไม่ได้
export function NavToggle({ placement = "sidebar" }: Readonly<{ placement?: "sidebar" | "topbar" }>) {
  const context = useContext(NavShellContext);
  // หน้าที่ไม่ได้อยู่ใต้ NavShell เช่นหน้าตั้งค่าที่ซ่อนแถบข้าง ไม่มีอะไรให้เปิดปิด
  if (!context) return null;
  const { isMenuVisible, isMobile, toggle } = context;
  // บนมือถือเมนูเปิดปิดทั้งแผง บนจอใหญ่แค่ย่อหรือขยาย จึงใช้คำต่างกัน
  const labels = isMobile ? { visible: "ปิดเมนู", hidden: "เปิดเมนู" } : { visible: "ย่อเมนู", hidden: "ขยายเมนู" };
  const label = isMenuVisible ? labels.visible : labels.hidden;

  return <button
    aria-controls={appSidebarId}
    aria-expanded={isMenuVisible}
    aria-label={label}
    className={`nav-toggle nav-toggle-${placement}`}
    onClick={toggle}
    title={label}
    type="button"
  >
    <HamburgerIcon isMenuVisible={isMenuVisible} />
  </button>;
}
