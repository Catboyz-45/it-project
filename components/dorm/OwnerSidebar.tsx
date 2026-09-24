"use client";
// เมนูด้านซ้ายของพื้นที่เจ้าของหอ แยกออกจาก DormDashboard เพราะเป็นหน้าจอล้วน ๆ
// สถานะเปิดปิดของแต่ละเมนูเป็นเรื่องภายในของเมนูนั้นเอง จึงเก็บไว้ตรงนี้ ไม่ต้องรบกวนเปลือก

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";
import type { PageKey } from "@/types/navigation";
import { ownerPagePath } from "@/lib/navigation-routes";
import { platformProfile } from "@/lib/platform-profile";
import { MenuBadge } from "@/components/dorm/OwnerShellParts";

export type DashboardProperty = { id: string; name: string; shortName: string; rooms?: number };

// สามหน้านี้ไม่มีในเมนูหลัก มิเตอร์อยู่ในเมนูย่อย ส่วนประวัติซ่อมเข้าจากหน้าเรื่องร้องเรียน
type MenuPageKey = Exclude<PageKey, "repairHistory" | "waterMeter" | "electricMeter">;
type MenuItem = { key: MenuPageKey; label: string; icon: ComponentType<{ size?: number }> };

const menuItems: MenuItem[] = [
  { key: "overview", label: "แดชบอร์ด", icon: Home },
  { key: "rooms", label: "ผังห้องพัก", icon: Building2 },
  { key: "tenants", label: "ผู้เช่า", icon: UserRound },
  { key: "contracts", label: "สัญญาเช่า", icon: FileText },
];

const secondaryMenuItems: MenuItem[] = [
  { key: "invoices", label: "บิลและการเงิน", icon: QrCode },
  { key: "complaints", label: "ร้องเรียน", icon: Wrench },
  { key: "parcels", label: "คลังพัสดุ", icon: PackageCheck },
];

// ประวัติซ่อมไม่มีเมนูของตัวเอง เข้าจากหน้าเรื่องร้องเรียน จึงต้องให้เมนูนั้นสว่างค้างไว้
function isActiveMenu(activePage: PageKey, key: MenuPageKey) {
  return activePage === key || (activePage === "repairHistory" && key === "complaints");
}

export function OwnerSidebar({
  accountEmail,
  accountName,
  activePage,
  activeProperty,
  availableProperties,
  isReadOnly,
  navigateTo,
  notificationCounts,
  propertyId,
}: Readonly<{
  accountEmail: string;
  accountName: string;
  activePage: PageKey;
  activeProperty: DashboardProperty;
  availableProperties: DashboardProperty[];
  isReadOnly: boolean;
  navigateTo: (page: PageKey) => void;
  notificationCounts: Partial<Record<PageKey, number>>;
  propertyId: string;
}>) {
  return <aside aria-label="เมนูหลัก" className="sidebar">
    <PropertySwitcher activeProperty={activeProperty} availableProperties={availableProperties} propertyId={propertyId} />
    <nav>
      {menuItems.map((item) => <MenuLink activePage={activePage} isReadOnly={isReadOnly} item={item} notificationCounts={notificationCounts} propertyId={propertyId} key={item.key} />)}
      <MetersMenu activePage={activePage} propertyId={propertyId} />
      {secondaryMenuItems.map((item) => <MenuLink activePage={activePage} isReadOnly={isReadOnly} item={item} notificationCounts={notificationCounts} propertyId={propertyId} key={item.key} />)}
      <Link className={activePage === "announcements" ? "active" : ""} href={ownerPagePath(propertyId, "announcements")}>
        <Megaphone size={18} />
        <span>ประกาศ/ข่าวสาร</span>
      </Link>
    </nav>
    <AccountMenu
      accountEmail={accountEmail}
      accountName={accountName}
      activePage={activePage}
      activeProperty={activeProperty}
      navigateTo={navigateTo}
    />
  </aside>;
}

function MenuLink({ activePage, isReadOnly, item, notificationCounts, propertyId }: Readonly<{
  activePage: PageKey;
  isReadOnly: boolean;
  item: MenuItem;
  notificationCounts: Partial<Record<PageKey, number>>;
  propertyId: string;
}>) {
  const Icon = item.icon;
  return <Link className={isActiveMenu(activePage, item.key) ? "active" : ""} href={ownerPagePath(propertyId, item.key)}>
    <Icon size={18} />
    <span>{item.label}</span>
    <MenuBadge count={notificationCounts[item.key] ?? 0} isReadOnly={isReadOnly} />
  </Link>;
}

function PropertySwitcher({ activeProperty, availableProperties, propertyId }: Readonly<{
  activeProperty: DashboardProperty;
  availableProperties: DashboardProperty[];
  propertyId: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);

  const openProperty = (id: string) => {
    setIsOpen(false);
    // สลับหอพักต้องโหลดใหม่ทั้งหน้าโดยตั้งใจ เพื่อทิ้ง state และแคชข้อมูลของหอเดิมให้หมด
    // ไม่ใช้ router.push() ที่จะพาข้อมูลข้ามหอพักติดไปด้วย
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (id !== propertyId) window.location.assign(`/admin/properties/${id}`);
  };

  return <div className="sidebar-property">
    <button aria-expanded={isOpen} className="brand" onClick={() => setIsOpen((current) => !current)} type="button">
      <span className="brand-platform-mark">
        <Image alt="" aria-hidden="true" className="size-full object-contain" height={40} src={platformProfile.logoPath} width={40} />
      </span>
      <span className="brand-copy">
        <strong>{activeProperty.shortName}</strong>
        <small>ระบบบริหารหอพัก</small>
      </span>
      <ChevronsUpDown className="brand-switch-icon" size={17} />
    </button>
    {isOpen ? <div className="property-menu sidebar-property-menu" role="menu">
      <p>เลือกหอพัก</p>
      {availableProperties.map((property) => <button key={property.id} onClick={() => openProperty(property.id)} role="menuitem" type="button">
        <span className="property-avatar">{property.shortName.slice(0, 1)}</span>
        <span><strong>{property.shortName}</strong>{property.rooms !== undefined ? <small>{property.rooms} ห้อง</small> : null}</span>
        {property.id === propertyId ? <Check size={16} /> : null}
      </button>)}
    </div> : null}
  </div>;
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

function AccountMenu({ accountEmail, accountName, activePage, activeProperty, navigateTo }: Readonly<{
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
      <button onClick={() => go("account")} type="button"><UserRound size={18} /> บัญชีและความปลอดภัย</button>
      <button onClick={() => go("settings")} type="button"><Settings size={18} /> ตั้งค่าระบบ</button>
      <span />
      <button onClick={() => go("help")} type="button"><HelpCircle size={18} /> ช่วยเหลือ</button>
      <span />
      <button className="danger" onClick={signOut} type="button"><LogOut size={18} /> ออกจากระบบ</button>
    </div> : null}
    <button
      aria-expanded={isOpen}
      aria-label="เปิดเมนูตั้งค่า"
      className={isSettingsArea(activePage) ? "active" : ""}
      onClick={() => setIsOpen((current) => !current)}
      type="button"
    >
      <UserRound size={18} />
      <span>ตั้งค่า</span>
    </button>
  </div>;
}

// สามหน้านี้ใช้ SettingsPage ร่วมกัน จึงถือเป็นพื้นที่ตั้งค่าเดียวกันทั้งหมด
// ไม่ว่าจะเข้าจากเมนูตั้งค่าหรือเปิด URL ตรง และใช้โครงหน้าคนละแบบกับหน้าอื่น
export function isSettingsArea(activePage: PageKey) {
  return activePage === "settings" || activePage === "invitations" || activePage === "subscription";
}
