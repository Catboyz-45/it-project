"use client";
// เมนูด้านซ้ายของพื้นที่เจ้าของหอ แยกออกจาก DormDashboard เพราะเป็นหน้าจอล้วน ๆ
// สถานะเปิดปิดของแต่ละเมนูเป็นเรื่องภายในของเมนูนั้นเอง จึงเก็บไว้ตรงนี้ ไม่ต้องรบกวนเปลือก

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Droplets,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  LogOut,
  Megaphone,
  PackageCheck,
  QrCode,
  Settings,
  ShieldCheck,
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";
import type { PageKey } from "@/types/navigation";
import { ownerPagePath } from "@/lib/navigation-routes";
import { MenuBadge } from "@/components/dorm/OwnerShellParts";
import { appSidebarId, NavToggle } from "@/components/ui/NavShell";
import { AccountChip } from "@/components/ui/AccountChip";
import { rovingIndex } from "@/components/ui/use-tablist-keyboard";
import { firstInitial } from "@/lib/account-initials";
import { assignPropertyTones, type PropertyTone } from "@/lib/property-tone";

export type DashboardProperty = { id: string; name: string; shortName: string; rooms?: number };

// สามหน้านี้ไม่มีในเมนูหลัก มิเตอร์อยู่ในเมนูย่อย ส่วนประวัติซ่อมเข้าจากหน้าเรื่องร้องเรียน
type MenuPageKey = Exclude<PageKey, "repairHistory" | "waterMeter" | "electricMeter">;
type MenuItem = { key: MenuPageKey; label: string; icon: ComponentType<{ size?: number }> };

const menuItems: MenuItem[] = [
  { key: "overview", label: "หน้าหลัก", icon: Home },
  { key: "rooms", label: "ผังห้องพัก", icon: Building2 },
  { key: "tenants", label: "ผู้เช่า", icon: UserRound },
  { key: "contracts", label: "สัญญาเช่า", icon: FileText },
];

const secondaryMenuItems: MenuItem[] = [
  { key: "invoices", label: "บิลและการเงิน", icon: QrCode },
  { key: "complaints", label: "แจ้งซ่อม/ร้องเรียน", icon: Wrench },
  { key: "parcels", label: "คลังพัสดุ", icon: PackageCheck },
];

// ประวัติซ่อมไม่มีเมนูของตัวเอง เข้าจากหน้าเรื่องร้องเรียน จึงต้องให้เมนูนั้นสว่างค้างไว้
function isActiveMenu(activePage: PageKey, key: MenuPageKey) {
  return activePage === key || (activePage === "repairHistory" && key === "complaints");
}

export function OwnerSidebar({
  accountAvatarUrl,
  accountEmail,
  accountName,
  activePage,
  activeProperty,
  availableProperties,
  isReadOnly,
  navigateTo,
  notificationCounts,
  propertyId,
  urgentPages,
}: Readonly<{
  accountAvatarUrl?: string | null;
  accountEmail: string;
  accountName: string;
  activePage: PageKey;
  activeProperty: DashboardProperty;
  availableProperties: DashboardProperty[];
  isReadOnly: boolean;
  navigateTo: (page: PageKey) => void;
  notificationCounts: Partial<Record<PageKey, number>>;
  propertyId: string;
  urgentPages: Partial<Record<PageKey, boolean>>;
}>) {
  return <aside aria-label="เมนูหลัก" className="sidebar" id={appSidebarId}>
    <div className="sidebar-head">
      <PropertySwitcher activeProperty={activeProperty} availableProperties={availableProperties} propertyId={propertyId} />
      <NavToggle />
    </div>
    <nav>
      {menuItems.map((item) => <MenuLink activePage={activePage} isReadOnly={isReadOnly} item={item} notificationCounts={notificationCounts} propertyId={propertyId} urgentPages={urgentPages} key={item.key} />)}
      <MetersMenu activePage={activePage} propertyId={propertyId} />
      {secondaryMenuItems.map((item) => <MenuLink activePage={activePage} isReadOnly={isReadOnly} item={item} notificationCounts={notificationCounts} propertyId={propertyId} urgentPages={urgentPages} key={item.key} />)}
      <Link className={activePage === "announcements" ? "active" : ""} href={ownerPagePath(propertyId, "announcements")}>
        <Megaphone size={18} />
        <span>ประกาศ/ข่าวสาร</span>
      </Link>
    </nav>
    {/* ตั้งค่าหอแยกออกมาเป็นเมนูของตัวเองแบบ GitHub/Stripe ปุ่มบัญชีข้างล่างจะเหลือแค่เรื่องบัญชี ไม่ปนกัน */}
    <div className="sidebar-footer-links">
      <Link className={isSettingsArea(activePage) ? "active" : ""} href={ownerPagePath(propertyId, "settings")}>
        <Settings size={18} />
        <span>ตั้งค่าหอ</span>
      </Link>
    </div>
    <AccountMenu
      accountAvatarUrl={accountAvatarUrl}
      accountEmail={accountEmail}
      accountName={accountName}
      activePage={activePage}
      activeProperty={activeProperty}
      navigateTo={navigateTo}
    />
  </aside>;
}

function MenuLink({ activePage, isReadOnly, item, notificationCounts, propertyId, urgentPages }: Readonly<{
  activePage: PageKey;
  isReadOnly: boolean;
  item: MenuItem;
  notificationCounts: Partial<Record<PageKey, number>>;
  propertyId: string;
  urgentPages: Partial<Record<PageKey, boolean>>;
}>) {
  const Icon = item.icon;
  return <Link className={isActiveMenu(activePage, item.key) ? "active" : ""} href={ownerPagePath(propertyId, item.key)}>
    <Icon size={18} />
    <span>{item.label}</span>
    <MenuBadge count={notificationCounts[item.key] ?? 0} isReadOnly={isReadOnly} isUrgent={urgentPages[item.key]} />
  </Link>;
}

function PropertySwitcher({ activeProperty, availableProperties, propertyId }: Readonly<{
  activeProperty: DashboardProperty;
  availableProperties: DashboardProperty[];
  propertyId: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const tones = assignPropertyTones(availableProperties.map(({ id }) => id));

  // เปิดแล้วโฟกัสหอที่ดูอยู่ คลิกนอกเมนูหรือกด Escape แล้วปิด เหมือนเมนูบัญชีข้างล่าง
  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"], [role="menuitem"]')?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  // ลูกศรขึ้นลงเลื่อนระหว่างหอ Home/End ไปหัวท้าย กด Tab ออกไปแล้วปิดเมนู ไม่ให้ค้างบังเมนูหลัก
  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    event.preventDefault();
    items[rovingIndex(event.key, items.indexOf(document.activeElement as HTMLButtonElement), items.length)]?.focus();
  };

  const openProperty = (id: string) => {
    setIsOpen(false);
    // สลับหอพักต้องโหลดใหม่ทั้งหน้าโดยตั้งใจ เพื่อทิ้ง state และแคชข้อมูลของหอเดิมให้หมด
    // ไม่ใช้ router.push() ที่จะพาข้อมูลข้ามหอพักติดไปด้วย
    // อยู่หน้าไหนก็ไปหน้าเดียวกันของหอใหม่ เช่นหน้าสัญญาไปหน้าสัญญา ไม่เด้งกลับแดชบอร์ดทุกครั้ง
    // เก็บแค่ชื่อหน้า ไม่เอา id ของรายการลึกกว่านั้นติดไป เพราะเป็นของหอเดิม (มิเตอร์มีสองระดับ เช่น meters/water)
    if (id === propertyId) return;
    const prefix = `/admin/properties/${propertyId}/`;
    const segments = window.location.pathname.startsWith(prefix) ? window.location.pathname.slice(prefix.length).split("/") : [];
    const section = segments[0] === "meters" ? segments.slice(0, 2).join("/") : segments[0] ?? "";
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/admin/properties/${id}${section ? `/${section}` : ""}`);
  };

  // ปุ่มด้านบนบอกว่ากำลังดูหอไหน ด้วยตัวย่อและสีของหอนั้น แทนโลโก้ระบบที่เหมือนกันทุกหอ
  return <div className="sidebar-property" ref={rootRef}>
    <button aria-controls={isOpen ? menuId : undefined} aria-expanded={isOpen} aria-haspopup="menu" aria-label={`เปลี่ยนหอพัก ตอนนี้ดู ${activeProperty.name}`} className="brand" onClick={() => setIsOpen((current) => !current)} ref={triggerRef} type="button">
      <PropertyMark property={activeProperty} tone={tones.get(activeProperty.id)} />
      <span className="brand-copy">
        <strong>{activeProperty.shortName}</strong>
        {/* ลูกศรขึ้นลงข้างท้ายบอกอยู่แล้วว่ากดเปลี่ยนหอได้ บรรทัดนี้จึงบอกแค่จำนวนห้อง แถบข้างแคบจะได้ไม่ตัดบรรทัด */}
        {activeProperty.rooms !== undefined ? <small>{activeProperty.rooms} ห้อง</small> : null}
      </span>
      <ChevronsUpDown aria-hidden="true" className="brand-switch-icon" size={17} />
    </button>
    {isOpen ? <div aria-labelledby={`${menuId}-label`} className="property-menu sidebar-property-menu" id={menuId} onKeyDown={moveFocus} ref={menuRef} role="menu">
      <p id={`${menuId}-label`}>หอพักของคุณ</p>
      {availableProperties.map((property) => {
        const isCurrent = property.id === propertyId;
        return <button aria-current={isCurrent ? "true" : undefined} className={isCurrent ? "is-current" : undefined} key={property.id} onClick={() => openProperty(property.id)} role="menuitem" type="button">
          <PropertyMark property={property} tone={tones.get(property.id)} />
          <span>
            <strong>{property.shortName}</strong>
            {property.rooms !== undefined || isCurrent ? <small>{[property.rooms !== undefined ? `${property.rooms} ห้อง` : null, isCurrent ? "กำลังดูอยู่" : null].filter(Boolean).join(" · ")}</small> : null}
          </span>
          {isCurrent ? <Check aria-hidden="true" className="property-menu-check" size={16} /> : null}
        </button>;
      })}
    </div> : null}
  </div>;
}

// ตัวย่อของหอบนพื้นสีประจำหอ ภาษาไทยข้ามสระหน้าไปเอาพยัญชนะ "เรือนไทย" ได้ "ร" ไม่ใช่ "เ"
function PropertyMark({ property, tone }: Readonly<{ property: DashboardProperty; tone?: PropertyTone }>) {
  return <span aria-hidden="true" className="property-avatar" data-tone={tone}>{firstInitial(property.shortName)}</span>;
}

function MetersMenu({ activePage, propertyId }: Readonly<{ activePage: PageKey; propertyId: string }>) {
  const [isOpen, setIsOpen] = useState(true);
  // ปิดอยู่ก็ต้องกด Tab ข้ามไป ไม่งั้นโฟกัสจะหายเข้าไปในเมนูที่มองไม่เห็น
  const linkTabIndex = isOpen ? undefined : -1;

  return <div className="sidebar-group">
    <button aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} type="button">
      <Gauge size={18} />
      <span>ค่าน้ำและค่าไฟ</span>
      <ChevronDown className={isOpen ? "sidebar-chevron open" : "sidebar-chevron"} size={17} />
    </button>
    {/* คงไว้ใน DOM เสมอแล้วสลับคลาสแทนการถอดออก ไม่งั้นความสูงกระโดดทันทีจนไม่มีอะไรให้ค่อย ๆ กาง */}
    <div aria-hidden={!isOpen} className={isOpen ? "sidebar-subnav open" : "sidebar-subnav"}>
      <div>
        <Link className={activePage === "waterMeter" ? "active" : ""} href={ownerPagePath(propertyId, "waterMeter")} tabIndex={linkTabIndex}>
          <Droplets size={17} />
          <span>มิเตอร์น้ำ</span>
        </Link>
        <Link className={activePage === "electricMeter" ? "active" : ""} href={ownerPagePath(propertyId, "electricMeter")} tabIndex={linkTabIndex}>
          <Zap size={17} />
          <span>มิเตอร์ไฟ</span>
        </Link>
      </div>
    </div>
  </div>;
}

function AccountMenu({ accountAvatarUrl, accountEmail, accountName, activePage, activeProperty, navigateTo }: Readonly<{
  accountAvatarUrl?: string | null;
  accountEmail: string;
  accountName: string;
  activePage: PageKey;
  activeProperty: DashboardProperty;
  navigateTo: (page: PageKey) => void;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ปิดเมนูเมื่อคลิกนอกกล่องหรือกด Escape ตามพฤติกรรมเมนูที่ผู้ใช้คาดหวัง
  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
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

  const go = (page: PageKey) => {
    navigateTo(page);
    setIsOpen(false);
  };

  const signOut = () => {
    void fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      // ออกจากระบบต้องโหลดใหม่ทั้งหน้า เพื่อทิ้ง state และแคช RSC ของผู้ใช้เดิมทั้งหมด
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      .finally(() => window.location.assign("/login"));
  };

  return <div className="sidebar-footer" ref={containerRef}>
    {isOpen ? <div className="account-menu" role="menu">
      <p>
        <strong>{activeProperty.shortName}</strong>
        <span>{accountName}</span>
        {accountEmail ? <small>{accountEmail}</small> : null}
      </p>
      <button onClick={() => go("account")} type="button"><ShieldCheck size={18} /> บัญชีของฉัน</button>
      <span />
      <button onClick={() => go("help")} type="button"><HelpCircle size={18} /> ช่วยเหลือ</button>
      <span />
      <button className="danger" onClick={signOut} type="button"><LogOut size={18} /> ออกจากระบบ</button>
    </div> : null}
    <button
      aria-expanded={isOpen}
      aria-haspopup="menu"
      aria-label={`เปิดเมนูบัญชี ${accountName} เจ้าของหอ`}
      className={`account-chip-trigger${activePage === "account" ? " active" : ""}`}
      onClick={() => setIsOpen((current) => !current)}
      type="button"
    >
      <AccountChip avatarUrl={accountAvatarUrl} context={activeProperty.shortName} name={accountName} roleLabel="เจ้าของหอ" tone="owner" />
    </button>
  </div>;
}

// สามหน้านี้ใช้ SettingsPage ร่วมกัน จึงถือเป็นพื้นที่ตั้งค่าเดียวกันทั้งหมด
// ไม่ว่าจะเข้าจากเมนูตั้งค่าหรือเปิด URL ตรง และใช้โครงหน้าคนละแบบกับหน้าอื่น
export function isSettingsArea(activePage: PageKey) {
  return activePage === "settings" || activePage === "invitations" || activePage === "subscription";
}
