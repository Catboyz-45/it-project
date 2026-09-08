"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Dorm Dashboard” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { RetryButton } from "@/components/ui/DataNavigation";
import {
  Building2,
  AlertTriangle,
  Banknote,
  Check,
  ChevronDown,
  Droplets,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  LockKeyhole,
  LogOut,
  PackageCheck,
  QrCode,
  CreditCard,
  Settings,
  ChevronsUpDown,
  Megaphone,
  MessageSquare,
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";
import { ContractsPage } from "@/components/dorm/pages/ContractsPage";
import {
  AnnouncementsPage,
  ComplaintsPage,
  HelpPage,
  PropertiesPage,
} from "@/components/dorm/pages/AdditionalPages";
import { ChatWidget } from "@/components/dorm/ChatWidget";
import { InvoicesPage } from "@/components/dorm/pages/InvoicesPage";
import { MetersPage } from "@/components/dorm/pages/MetersPage";
import { OverviewPage } from "@/components/dorm/pages/OverviewPage";
import { ParcelsPage, type ParcelView } from "@/components/dorm/pages/ParcelsPage";
import { RepairHistoryPage } from "@/components/dorm/pages/RepairHistoryPage";
import { RoomsPage } from "@/components/dorm/pages/RoomsPage";
import { SettingsPage } from "@/components/dorm/pages/SettingsPage";
import { TenantsPage } from "@/components/dorm/pages/TenantsPage";
import { RoomEditModal, type RoomEditPayload } from "@/components/dorm/RoomEditModal";
import { TenantEditModal, type TenantEditPayload } from "@/components/dorm/TenantEditModal";
import { TenantDetailModal } from "@/components/dorm/TenantDetailModal";
import type { Invoice, Room, Tenant } from "@/types/dorm";
import type { DashboardSummary, PageKey } from "@/types/navigation";
import type { OwnerDashboardAggregation, OwnerWorkspaceReadModel } from "@/types/dashboard";
import { ownerPagePath } from "@/lib/navigation-routes";
import { blocksSubscriptionMutations, resolveSubscriptionUiAccessState } from "@/lib/client/subscription-access-state";
import { platformProfile } from "@/lib/platform-profile";
import { NotificationCenter, type NotificationCenterItem } from "@/components/ui/NotificationCenter";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { OwnerGlobalSearch } from "@/components/dorm/OwnerGlobalSearch";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Menu Page Key” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type MenuPageKey = Exclude<PageKey, "repairHistory" | "waterMeter" | "electricMeter">;
/** สีประจำหมวดของไอคอนเมนู (ดู .sidebar nav [data-accent] ใน globals.css) */
type MenuAccent = "green" | "magenta" | "cyan";
const menuItems: Array<{ accent?: MenuAccent; key: MenuPageKey; label: string; icon: ComponentType<{ size?: number }> }> = [
  { key: "overview", label: "แดชบอร์ด", icon: Home },
  { key: "rooms", label: "ผังห้องพัก", icon: Building2 },
  { key: "tenants", label: "ผู้เช่า", icon: UserRound },
  { key: "contracts", label: "สัญญาเช่า", icon: FileText },
];

const secondaryMenuItems: Array<{ accent?: MenuAccent; key: MenuPageKey; label: string; icon: ComponentType<{ size?: number }> }> = [
  { accent: "green", key: "invoices", label: "บิลและการเงิน", icon: QrCode },
  { accent: "magenta", key: "complaints", label: "ร้องเรียน", icon: Wrench },
  { accent: "cyan", key: "parcels", label: "คลังพัสดุ", icon: PackageCheck },
];

const pageTitles: Record<PageKey, { title: string; subtitle: string }> = {
  overview: { title: "แดชบอร์ด", subtitle: "ภาพรวมการดำเนินงาน รายได้ ห้องพัก และรายการที่ต้องดำเนินการ" },
  rooms: { title: "ผังห้องพัก", subtitle: "ผังห้องแบบ Visual Floor Plan พร้อมสถานะและข้อมูลผู้เช่า" },
  tenants: { title: "ผู้เช่า", subtitle: "จัดการข้อมูลผู้เช่าทั้งหมดในหอพัก" },
  contracts: { title: "สัญญาเช่า", subtitle: "จัดการสัญญา ตรวจเอกสาร และต่อสัญญารายห้อง" },
  waterMeter: { title: "ค่าน้ำและค่าไฟ", subtitle: "บันทึกมิเตอร์รายเดือนของแต่ละห้อง" },
  electricMeter: { title: "ค่าน้ำและค่าไฟ", subtitle: "บันทึกมิเตอร์รายเดือนของแต่ละห้อง" },
  invoices: { title: "บิลและการเงิน", subtitle: "จัดการบิลค่าเช่าและภาพรวมการเงินของหอพัก" },
  repairHistory: { title: "ประวัติการซ่อม", subtitle: "ค้นหางานซ่อมที่เสร็จแล้วตามชั้น ห้อง หรือรายการซ่อม" },
  complaints: { title: "เรื่องร้องเรียน", subtitle: "ติดตาม ตรวจสอบ และจัดการเรื่องร้องเรียนจากผู้เช่า" },
  parcels: { title: "คลังพัสดุ", subtitle: "ระบบรับพัสดุสำหรับผู้เช่า" },
  announcements: { title: "ประกาศ/ข่าวสาร", subtitle: "สร้างและเผยแพร่ข่าวสารถึงผู้เช่าในหอพัก" },
  invitations: { title: "คำเชิญผู้เช่า", subtitle: "สร้าง ติดตาม และยกเลิกคำเชิญเข้าพักรายห้อง" },
  subscription: { title: "แพ็กเกจและการต่ออายุ", subtitle: "เลือกแพ็กเกจ ส่งหลักฐาน และติดตามการต่ออายุ SaaS" },
  help: { title: "ศูนย์ช่วยเหลือ", subtitle: "คู่มือและคำแนะนำการใช้งานแพลตฟอร์ม" },
  properties: { title: "จัดการหอพัก", subtitle: "เลือกหอพักที่ต้องการจัดการ" },
  account: { title: "บัญชีและความปลอดภัย", subtitle: "จัดการข้อมูลโปรไฟล์ รหัสผ่าน และความปลอดภัยของบัญชี" },
  settings: { title: "ตั้งค่า", subtitle: "ตั้งค่าข้อมูลหอ ค่าใช้จ่าย โครงเอกสาร และข้อมูลสำหรับระบบ" },
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Dashboard Property” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type DashboardProperty = { id: string; name: string; shortName: string; rooms?: number };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “optional Tenant Text” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
const optionalTenantText = (value: string) => {
  const normalized = value.trim();
  return normalized && normalized !== "-" ? normalized : null;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Dorm Dashboard” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { activePage, authenticatedEmail, authenticatedUser, availab: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function DormDashboard({
  activePage,
  authenticatedEmail,
  authenticatedUser,
  availableProperties,
  initialAggregation,
  initialData,
  initialInvoiceView = "invoices",
  propertyId,
}: {
  activePage: PageKey;
  authenticatedEmail?: string;
  authenticatedUser?: string;
  availableProperties: DashboardProperty[];
  initialAggregation: OwnerDashboardAggregation;
  initialData: OwnerWorkspaceReadModel;
  initialInvoiceView?: "invoices" | "payments";
  propertyId: string;
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(authenticatedUser ?? "");
  const [isMetersMenuOpen, setIsMetersMenuOpen] = useState(true);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [parcelView] = useState<ParcelView>("waiting");
  const [shouldOpenComplaintAdd, setShouldOpenComplaintAdd] = useState(false);
  const [rooms, setRooms] = useState<Room[]>(initialData.rooms);
  const [tenants, setTenants] = useState<Tenant[]>(initialData.tenants);
  const [invoices, setInvoices] = useState<Invoice[]>(initialData.invoices);
  const [repairTickets, setRepairTickets] = useState(initialData.repairs);
  const [dashboardData, setDashboardData] = useState(initialData);
  const [dataError, setDataError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aggregation, setAggregation] = useState<OwnerDashboardAggregation | null>(initialAggregation);
  const [accessError, setAccessError] = useState("");
  const [unreadTicketReplies, setUnreadTicketReplies] = useState(0);
  const [openChatSignal, setOpenChatSignal] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState(initialData.rooms[0]?.id ?? "");
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [tenantModalMode] = useState<"add" | "edit">("edit");
  const [detailTenantId, setDetailTenantId] = useState<string | null>(null);
  const [isPropertyMenuOpen, setIsPropertyMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const activeProperty = availableProperties.find((property) => property.id === propertyId) ?? availableProperties[0];

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];
  const selectedTenant = selectedRoom ? tenants.find((tenant) => tenant.roomId === selectedRoom.id) : undefined;
  const detailTenant = detailTenantId ? tenants.find((tenant) => tenant.id === detailTenantId) : undefined;
  const accessState = resolveSubscriptionUiAccessState({
    accessMode: aggregation ? aggregation.subscription?.accessMode ?? "READ_ONLY" : null,
    error: accessError,
    isLoading: isRefreshing,
  });
  const isReadOnly = blocksSubscriptionMutations(accessState);
  const isInGracePeriod = accessState === "grace";
  const isSubscriptionExpiringSoon = Boolean(aggregation?.subscription)
    && new Date(aggregation!.subscription!.expiresAt).getTime() > Date.now()
    && new Date(aggregation!.subscription!.expiresAt).getTime() - Date.now() <= 30 * 86_400_000;
  const readOnlyMessage = "แพ็กเกจหมดอายุแล้ว พื้นที่นี้เปิดให้อ่านข้อมูลเท่านั้น กรุณาต่ออายุแพ็กเกจ";

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ตรวจเงื่อนไขของ “ensure Writable” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const ensureWritable = () => {
    if (!isReadOnly) return true;
    setDataError(accessState === "loading" || accessState === "error"
      ? "ยังตรวจสอบสิทธิ์การใช้งานไม่ได้ กรุณาลองโหลดข้อมูลใหม่"
      : readOnlyMessage);
    return false;
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “navigate To” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const navigateTo = useCallback((page: PageKey) => {
    router.push(ownerPagePath(propertyId, page));
  }, [propertyId, router]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “refresh Dashboard” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    setDataError("");
    setAccessError("");
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Json” แล้วส่งผลที่เหมาะสมกลับไป
     * รับค่า:
     * - url: ค่า “url” ที่จำเป็นต่อการทำงานของก้อนนี้
     * - fallbackMessage: ค่า “fallback Message” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
     */
    const loadJson = async <T,>(url: string, fallbackMessage: string) => {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json() as { data?: T; error?: string };
      if (!response.ok || payload.data === undefined || payload.data === null) {
        throw new Error(payload.error || fallbackMessage);
      }
      return payload.data;
    };
    const [workspaceResult, aggregationResult] = await Promise.allSettled([
      loadJson<OwnerWorkspaceReadModel>(
        `/api/v1/admin/properties/${propertyId}/dashboard`,
        "โหลดข้อมูลหอพักไม่สำเร็จ",
      ),
      loadJson<OwnerDashboardAggregation>(
        `/api/v1/admin/properties/${propertyId}/dashboard/summary`,
        "โหลดข้อมูลสรุปไม่สำเร็จ",
      ),
    ]);
    const errors: string[] = [];
    if (workspaceResult.status === "fulfilled") {
      const workspace = workspaceResult.value;
      setDashboardData(workspace);
      setRooms(workspace.rooms);
      setTenants(workspace.tenants);
      setInvoices(workspace.invoices);
      setRepairTickets(workspace.repairs);
    } else {
      errors.push(workspaceResult.reason instanceof Error
        ? workspaceResult.reason.message
        : "โหลดข้อมูลหอพักไม่สำเร็จ");
    }
    if (aggregationResult.status === "fulfilled") {
      setAggregation(aggregationResult.value);
    } else {
      setAggregation(null);
      const aggregationError = aggregationResult.reason instanceof Error
        ? aggregationResult.reason.message
        : "โหลดข้อมูลสรุปไม่สำเร็จ";
      setAccessError(aggregationError);
      errors.push(aggregationError);
    }
    setDataError(errors.join(" · "));
    setIsRefreshing(false);
  }, [propertyId]);

  useEffect(() => {
    void refreshDashboard();
  // Refresh whenever the workspace changes.
  }, [refreshDashboard]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “refresh Unread Ticket Replies” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const refreshUnreadTicketReplies = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/notifications/unread`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json() as { data?: { ticketReplies: number } };
      if (response.ok && payload.data) setUnreadTicketReplies(payload.data.ticketReplies);
    } catch {
      // The main dashboard error state remains independent from a badge refresh.
    }
  }, [propertyId]);

  useEffect(() => { void refreshUnreadTicketReplies(); }, [refreshUnreadTicketReplies]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Outside Click” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false);
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Escape” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAccountMenuOpen]);

  const filteredTenants = tenants;

  const summary: DashboardSummary | null = aggregation ? {
    occupied: aggregation.rooms.occupied,
    overdue: aggregation.finance.overdueInvoices,
    revenue: aggregation.finance.collected,
    pending: aggregation.finance.outstanding,
  } : null;
  const notificationCounts: Partial<Record<PageKey, number>> = aggregation ? {
    subscription: !aggregation.subscription
      || new Date(aggregation.subscription.expiresAt).getTime() - Date.now() <= 30 * 86_400_000
      ? 1
      : 0,
    overview: aggregation.pendingOccupancies
      + aggregation.finance.pendingPayments
      + aggregation.finance.overdueInvoices
      + aggregation.operations.openTickets
      + aggregation.operations.waitingParcels
      + aggregation.operations.unreadTenantMessages
      + aggregation.operations.expiringLeases
      + (!aggregation.subscription
        || new Date(aggregation.subscription.expiresAt).getTime() - Date.now() <= 30 * 86_400_000
        ? 1
        : 0),
    tenants: aggregation.pendingOccupancies,
    contracts: aggregation.operations.expiringLeases,
    invoices: aggregation.finance.pendingPayments + aggregation.finance.overdueInvoices,
    complaints: unreadTicketReplies || aggregation.operations.openTickets,
    parcels: aggregation.operations.waitingParcels,
  } : {};

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “menu Badge” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const menuBadge = (page: PageKey) => {
    const count = notificationCounts[page] ?? 0;
    return count > 0
      ? <span className="notification-badge" aria-label={`${count} รายการ${isReadOnly ? "สำหรับตรวจสอบ" : "ที่ต้องดำเนินการ"}`}>{count > 99 ? "99+" : count}</span>
      : null;
  };

  const ownerNotifications: NotificationCenterItem[] = aggregation ? [
    { id: "pending-occupancies", count: aggregation.pendingOccupancies, title: "คำขอเข้าพักที่ยังรอดำเนินการ", description: isReadOnly ? "เปิดดูรายละเอียดได้ การอนุมัติจะกลับมาใช้ได้หลังต่ออายุแพ็กเกจ" : "ตรวจสอบข้อมูลผู้เช่าก่อนอนุมัติเข้าพัก", href: `${ownerPagePath(propertyId, "tenants")}?tab=pending`, icon: <UserRound size={19} /> },
    { id: "pending-payments", count: aggregation.finance.pendingPayments, title: "หลักฐานชำระเงินที่ยังรอตรวจสอบ", description: isReadOnly ? "เปิดดูหลักฐานได้ การยืนยันรับชำระจะกลับมาใช้ได้หลังต่ออายุแพ็กเกจ" : "ตรวจสอบสลิปและยืนยันการรับชำระ", href: `${ownerPagePath(propertyId, "invoices")}?tab=payments`, icon: <Banknote size={19} /> },
    { id: "overdue-invoices", count: aggregation.finance.overdueInvoices, title: "บิลเกินกำหนดชำระ", description: isReadOnly ? "เปิดดูรายการและยอดค้างชำระได้ในโหมดอ่านอย่างเดียว" : "ติดตามบิลที่ยังไม่ได้รับชำระ", href: ownerPagePath(propertyId, "invoices"), icon: <AlertTriangle size={19} /> },
    { id: "open-tickets", count: aggregation.operations.openTickets, title: "เรื่องแจ้งที่ยังไม่เสร็จ", description: isReadOnly ? "เปิดดูสถานะและประวัติได้ การอัปเดตจะกลับมาใช้ได้หลังต่ออายุแพ็กเกจ" : "ติดตามงานซ่อมและเรื่องร้องเรียนจากผู้เช่า", href: ownerPagePath(propertyId, "complaints"), icon: <Wrench size={19} /> },
    { id: "ticket-replies", count: unreadTicketReplies, title: "ข้อความตอบกลับเรื่องแจ้ง", description: isReadOnly ? "เปิดอ่านข้อความและประวัติเดิมได้ในโหมดอ่านอย่างเดียว" : "มีข้อความใหม่จากผู้เช่าที่ยังไม่ได้อ่าน", href: ownerPagePath(propertyId, "complaints"), icon: <MessageSquare size={19} /> },
    { id: "waiting-parcels", count: aggregation.operations.waitingParcels, title: "พัสดุที่ยังรอผู้เช่ารับ", description: isReadOnly ? "เปิดดูรายการได้ การบันทึกรับพัสดุจะกลับมาใช้ได้หลังต่ออายุแพ็กเกจ" : "รายการพัสดุที่ยังไม่ได้ส่งมอบ", href: ownerPagePath(propertyId, "parcels"), icon: <PackageCheck size={19} /> },
    { id: "tenant-messages", count: aggregation.operations.unreadTenantMessages, title: "ข้อความใหม่จากผู้เช่า", description: isReadOnly ? "เปิดอ่านประวัติข้อความได้ แต่ยังตอบกลับไม่ได้" : "เปิดกล่องข้อความเพื่อตอบกลับผู้เช่า", onSelect: () => setOpenChatSignal((current) => current + 1), icon: <MessageSquare size={19} /> },
    { id: "expiring-leases", count: aggregation.operations.expiringLeases, title: "สัญญาใกล้หมดอายุ", description: isReadOnly ? "คำนวณจากวันสิ้นสุดสัญญา เปิดดูรายละเอียดได้ในโหมดอ่านอย่างเดียว" : "คำนวณจากวันสิ้นสุดอัตโนมัติ โปรดตรวจสอบและเตรียมต่อสัญญา", href: ownerPagePath(propertyId, "contracts"), icon: <FileText size={19} /> },
    {
      id: "subscription",
      count: !aggregation.subscription || new Date(aggregation.subscription.expiresAt).getTime() - Date.now() <= 30 * 86_400_000 ? 1 : 0,
      title: aggregation.subscription
        ? accessState === "read-only" ? "แพ็กเกจหมดอายุแล้ว" : "แพ็กเกจใกล้หมดอายุ"
        : "ยังไม่มีแพ็กเกจที่ใช้งานได้",
      description: accessState === "read-only" ? "เปิดหน้าสมาชิกเพื่อเลือกแพ็กเกจและต่ออายุการใช้งาน" : "ตรวจสอบแพ็กเกจและดำเนินการต่ออายุ",
      href: ownerPagePath(propertyId, "subscription"),
      icon: <CreditCard size={19} />,
    },
  ] : [];

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Meters” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - readings: ค่า “readings” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const saveMeters = async (readings: Array<{ roomId: string; type: "WATER" | "ELECTRICITY"; billingMonth: string; previousReading?: number; currentReading: number }>) => {
    if (!ensureWritable()) throw new Error(readOnlyMessage);
    const response = await fetch(`/api/v1/admin/properties/${propertyId}/meter-readings/bulk`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readings }),
    });
    if (!response.ok) {
      throw new Error(((await response.json()) as { error?: string }).error || "บันทึกมิเตอร์ไม่สำเร็จ");
    }
    await refreshDashboard();
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Room Edit” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - { room }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const saveRoomEdit = ({ room }: RoomEditPayload) => {
    if (!ensureWritable()) return;
    if (!room.databaseId) {
      setDataError("ไม่พบรหัสห้องในฐานข้อมูล");
      return;
    }
    void fetch(`/api/v1/admin/properties/${propertyId}/rooms/${room.databaseId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomType: room.roomType, monthlyRent: room.rent,
        floorId: room.floorId,
        ...(room.status === "occupied" ? {} : { status: room.status === "maintenance" ? "MAINTENANCE" : "AVAILABLE" }),
        furniture: room.furniture,
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "บันทึกห้องไม่สำเร็จ");
      setIsRoomModalOpen(false);
      await refreshDashboard();
    }).catch((error: unknown) => setDataError(error instanceof Error ? error.message : "บันทึกห้องไม่สำเร็จ"));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Tenant Edit” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - { tenant }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const saveTenantEdit = ({ tenant }: TenantEditPayload) => {
    if (!ensureWritable()) return;
    if (tenantModalMode === "add") {
      setDataError("ผู้เช่าต้องสมัครด้วยรหัสเชิญ แล้วเจ้าของหอจึงอนุมัติการเข้าพัก");
      return;
    }
    void fetch(`/api/v1/admin/properties/${propertyId}/tenants/${tenant.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: tenant.name,
        phone: tenant.phone,
        address: optionalTenantText(tenant.address),
        emergencyName: optionalTenantText(tenant.guardianName),
        emergencyPhone: optionalTenantText(tenant.guardianPhone),
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "บันทึกผู้เช่าไม่สำเร็จ");
      setIsTenantModalOpen(false);
      await refreshDashboard();
    }).catch((error: unknown) => setDataError(error instanceof Error ? error.message : "บันทึกผู้เช่าไม่สำเร็จ"));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Tenant Detail” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - tenant: ค่า “tenant” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const saveTenantDetail = (tenant: Tenant) => {
    if (!ensureWritable()) return;
    const vehicleType = tenant.vehicleType === "รถจักรยานยนต์" ? "MOTORCYCLE"
      : tenant.vehicleType === "รถยนต์" ? "CAR"
        : tenant.vehicleType === "รถจักรยาน" ? "BICYCLE"
          : tenant.vehicleType === "อื่น ๆ" ? "OTHER"
            : null;
    void fetch(`/api/v1/admin/properties/${propertyId}/tenants/${tenant.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: tenant.name,
        phone: tenant.phone,
        address: optionalTenantText(tenant.address),
        emergencyName: optionalTenantText(tenant.guardianName),
        emergencyPhone: optionalTenantText(tenant.guardianPhone),
        vehicle: vehicleType ? {
          type: vehicleType,
          licensePlate: tenant.vehiclePlate,
          province: tenant.vehicleProvince || null,
          brandModel: tenant.vehicleBrand || null,
          color: tenant.vehicleColor || null,
          detail: tenant.vehicleDetail || null,
        } : null,
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "บันทึกผู้เช่าไม่สำเร็จ");
      setDetailTenantId(null);
      await refreshDashboard();
    }).catch((error: unknown) => setDataError(error instanceof Error ? error.message : "บันทึกผู้เช่าไม่สำเร็จ"));
  };

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="เมนูหลัก">
        <div className="sidebar-property">
          <button aria-expanded={isPropertyMenuOpen} className="brand" onClick={() => setIsPropertyMenuOpen((current) => !current)} type="button">
            <span className="brand-platform-mark">
              <Image alt="" aria-hidden="true" className="size-full object-contain" height={40} src={platformProfile.logoPath} width={40} />
            </span>
            <span className="brand-copy">
              <strong>{activeProperty.shortName}</strong>
              <small>ระบบบริหารหอพัก</small>
            </span>
            <ChevronsUpDown className="brand-switch-icon" size={17} />
          </button>
          {isPropertyMenuOpen ? (
            <div className="property-menu sidebar-property-menu" role="menu">
              <p>เลือกหอพัก</p>
              {availableProperties.map((property) => (
                <button key={property.id} onClick={() => {
                  setIsPropertyMenuOpen(false);
                  if (property.id !== propertyId) window.location.assign(`/admin/properties/${property.id}`);
                }} role="menuitem" type="button">
                  <span className="property-avatar">{property.shortName.slice(0, 1)}</span>
                  <span><strong>{property.shortName}</strong>{property.rooms !== undefined ? <small>{property.rooms} ห้อง</small> : null}</span>
                  {property.id === propertyId ? <Check size={16} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <nav>
          {menuItems.map(({ accent, key, label, icon: Icon }) => (
            <Link className={activePage === key || (activePage === "repairHistory" && key === "complaints") ? "active" : ""} data-accent={accent} href={ownerPagePath(propertyId, key)} key={key}>
              <Icon size={18} />
              <span>{label}</span>
              {menuBadge(key)}
            </Link>
          ))}
          <div className="sidebar-group">
            <button
              aria-expanded={isMetersMenuOpen}
              data-accent="green"
              onClick={() => setIsMetersMenuOpen((current) => !current)}
              type="button"
            >
              <Gauge size={18} />
              <span>ค่าน้ำและค่าไฟ</span>
              <ChevronDown className={isMetersMenuOpen ? "sidebar-chevron open" : "sidebar-chevron"} size={17} />
            </button>
            {isMetersMenuOpen ? (
              <div className="sidebar-subnav">
                <Link className={activePage === "waterMeter" ? "active" : ""} data-accent="green" href={ownerPagePath(propertyId, "waterMeter")}>
                  <Droplets size={17} />
                  <span>มิเตอร์น้ำ</span>
                </Link>
                <Link className={activePage === "electricMeter" ? "active" : ""} data-accent="green" href={ownerPagePath(propertyId, "electricMeter")}>
                  <Zap size={17} />
                  <span>มิเตอร์ไฟ</span>
                </Link>
              </div>
            ) : null}
          </div>
          {secondaryMenuItems.map(({ accent, key, label, icon: Icon }) => (
            <Link className={activePage === key || (activePage === "repairHistory" && key === "complaints") ? "active" : ""} data-accent={accent} href={ownerPagePath(propertyId, key)} key={key}>
              <Icon size={18} />
              <span>{label}</span>
              {menuBadge(key)}
            </Link>
          ))}
          <Link className={activePage === "announcements" ? "active" : ""} href={ownerPagePath(propertyId, "announcements")}>
            <Megaphone size={18} />
            <span>ประกาศ/ข่าวสาร</span>
          </Link>
        </nav>
        <div className="sidebar-footer" ref={accountMenuRef}>
          {isAccountMenuOpen ? (
            <div className="account-menu" role="menu">
              <p>
                <strong>{activeProperty.shortName}</strong>
                <span>{currentUser}</span>
                {authenticatedEmail ? <small>{authenticatedEmail}</small> : null}
              </p>
              <button onClick={() => {
                navigateTo("account");
                setIsAccountMenuOpen(false);
              }} type="button"><UserRound size={18} /> บัญชีและความปลอดภัย</button>
              <button onClick={() => {
                navigateTo("settings");
                setIsAccountMenuOpen(false);
              }} type="button"><Settings size={18} /> ตั้งค่าระบบ</button>
              <span />
              <button onClick={() => {
                navigateTo("help");
                setIsAccountMenuOpen(false);
              }} type="button"><HelpCircle size={18} /> ช่วยเหลือ</button>
              <span />
              <button className="danger" onClick={() => {
                void fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
                  .finally(() => window.location.assign("/login"));
              }} type="button"><LogOut size={18} /> ออกจากระบบ</button>
            </div>
          ) : null}
          <button
            aria-expanded={isAccountMenuOpen}
            aria-label="เปิดเมนูตั้งค่า"
            className={["settings", "invitations", "subscription"].includes(activePage) ? "active" : ""}
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            type="button"
          >
            <UserRound size={18} />
            <span>ตั้งค่า</span>
          </button>
        </div>
      </aside>

      <section className={`${activePage === "settings" ? "workspace settings-workspace" : "workspace"}${isReadOnly ? " workspace-read-only" : ""}`}>
        <LiveAnnouncement message={`เปิดหน้า ${pageTitles[activePage].title}`} />
        {accessState === "loading" ? (
          <div className="subscription-access-banner grace" role="status">
            <span><CreditCard aria-hidden="true" /></span>
            <div>
              <strong>กำลังตรวจสอบสิทธิ์การใช้งาน</strong>
              <p>ระบบปิดการแก้ไขข้อมูลไว้ชั่วคราวระหว่างตรวจสอบสถานะแพ็กเกจ</p>
            </div>
          </div>
        ) : accessState === "error" ? (
          <div className="subscription-access-banner grace" role="alert">
            <span><AlertTriangle aria-hidden="true" /></span>
            <div>
              <strong>ยังตรวจสอบสิทธิ์การใช้งานไม่ได้</strong>
              <p>ระบบปิดการแก้ไขข้อมูลไว้ชั่วคราวเพื่อความปลอดภัย กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่</p>
            </div>
            <button className="primary-button" disabled={isRefreshing} onClick={() => void refreshDashboard()} type="button">
              {isRefreshing ? "กำลังตรวจสอบ..." : "ลองตรวจสอบใหม่"}
            </button>
          </div>
        ) : accessState === "read-only" ? (
          <div className="subscription-access-banner read-only" role="alert">
            <span><LockKeyhole aria-hidden="true" /></span>
            <div>
              <strong>พื้นที่นี้อยู่ในโหมดอ่านอย่างเดียว</strong>
              <p>ยังดู ค้นหา และดาวน์โหลดข้อมูลเดิมได้ แต่ไม่สามารถเพิ่ม แก้ไข อนุมัติ หรือสร้างรายการใหม่</p>
            </div>
            <Link className="primary-button" href={ownerPagePath(propertyId, "subscription")}>ต่ออายุแพ็กเกจ</Link>
          </div>
        ) : isInGracePeriod && aggregation?.subscription ? (
          <div className="subscription-access-banner grace" role="status">
            <span><CreditCard aria-hidden="true" /></span>
            <div>
              <strong>อยู่ในช่วงผ่อนผันหลังแพ็กเกจหมดอายุ</strong>
              <p>
                ยังแก้ไขข้อมูลได้ถึง {aggregation.subscription.graceEndsAt
                  ? new Date(aggregation.subscription.graceEndsAt).toLocaleDateString("th-TH")
                  : "-"} หลังจากนั้นระบบจะเปลี่ยนเป็นโหมดอ่านอย่างเดียว
              </p>
            </div>
            <Link className="primary-button" href={ownerPagePath(propertyId, "subscription")}>ต่ออายุแพ็กเกจ</Link>
          </div>
        ) : isSubscriptionExpiringSoon && aggregation?.subscription ? (
          <div className="form-alert" role="status">
            แพ็กเกจ {aggregation.subscription.planName} ใกล้หมดอายุวันที่ {new Date(aggregation.subscription.expiresAt).toLocaleDateString("th-TH")}
            {" · "}<Link href={ownerPagePath(propertyId, "subscription")}>ตรวจสอบและต่ออายุ</Link>
          </div>
        ) : null}
        {dataError ? <div className="form-alert error" role="alert"><span>{dataError}</span><RetryButton onClick={() => void refreshDashboard()} /></div> : null}
        {isRefreshing ? <div aria-atomic="true" className="document-editor-state" role="status">กำลังอัปเดตข้อมูล...</div> : null}
        <header className="topbar">
          <div>
            <h1>{pageTitles[activePage].title}</h1>
            <p className="page-subtitle">{pageTitles[activePage].subtitle}</p>
          </div>
          <div className="top-actions repair-top-actions">
            <OwnerGlobalSearch propertyId={propertyId} />
            <NotificationCenter isLoading={isRefreshing} items={ownerNotifications} onRefresh={async () => { await Promise.all([refreshDashboard(), refreshUnreadTicketReplies()]); }} readOnly={accessState === "read-only"} storageKey={`owner-notifications:${propertyId}`} />
          </div>
        </header>
        <div className="view-transition" key={activePage}>
        {activePage === "overview" && summary && aggregation && (
          <OverviewPage
            aggregation={aggregation}
            invoices={invoices}
            onOpenChat={() => setOpenChatSignal((current) => current + 1)}
            readOnly={isReadOnly}
            rooms={rooms}
            setActivePage={navigateTo}
            summary={summary}
            tenants={tenants}
          />
        )}
        {activePage === "overview" && !summary && (
          <div className="dashboard-empty-state" role="alert">
            <p>{isRefreshing ? "กำลังโหลดข้อมูลสรุป..." : "ไม่สามารถโหลดข้อมูลสรุปจากระบบได้"}</p>
            {!isRefreshing ? (
              <RetryButton label="ลองโหลดข้อมูลสรุปใหม่" onClick={() => void refreshDashboard()} />
            ) : null}
          </div>
        )}
        {activePage === "rooms" && (
          <RoomsPage
            invoices={invoices}
            onEditRoom={() => {
              setIsRoomModalOpen(true);
            }}
            readOnly={isReadOnly}
            rooms={rooms}
            selectedRoom={selectedRoom}
            setSelectedRoomId={setSelectedRoomId}
          />
        )}
        {activePage === "tenants" && (
          <TenantsPage
            filteredTenants={filteredTenants}
            onChanged={refreshDashboard}
            onOpenTenantDetail={(tenant) => {
              setTenants((current) => current.some((item) => item.id === tenant.id) ? current : [...current, tenant]);
              setDetailTenantId(tenant.id);
            }}
            propertyId={propertyId}
            readOnly={isReadOnly}
            setSelectedRoomId={setSelectedRoomId}
          />
        )}
        {activePage === "contracts" && <ContractsPage propertyId={propertyId} readOnly={isReadOnly} rooms={rooms} />}
        {(activePage === "waterMeter" || activePage === "electricMeter") && (
          <MetersPage
            mode={activePage === "waterMeter" ? "water" : "electric"}
            propertyId={propertyId}
            readOnly={isReadOnly}
            onSaveMeters={saveMeters}
          />
        )}
        {activePage === "invoices" && <InvoicesPage initialView={initialInvoiceView} invoices={invoices} onChanged={refreshDashboard} propertyId={propertyId} readOnly={isReadOnly} rooms={rooms} />}
        {activePage === "repairHistory" && (
          <RepairHistoryPage
            propertyId={propertyId}
            tickets={repairTickets}
          />
        )}
        {activePage === "complaints" && (
          <ComplaintsPage
            complaints={dashboardData.complaints}
            onChanged={refreshDashboard}
            onAddRequestHandled={() => setShouldOpenComplaintAdd(false)}
            openAddOnMount={shouldOpenComplaintAdd}
            propertyId={propertyId}
            readOnly={isReadOnly}
            onUnreadChanged={refreshUnreadTicketReplies}
          />
        )}
        {activePage === "parcels" && (
          <ParcelsPage
            activeView={parcelView}
            initialParcels={dashboardData.parcels}
            onChanged={refreshDashboard}
            propertyId={propertyId}
            readOnly={isReadOnly}
            rooms={rooms}
          />
        )}
        {activePage === "announcements" && <AnnouncementsPage
          initialAnnouncements={dashboardData.announcements}
          onChanged={refreshDashboard}
          propertyId={propertyId}
          readOnly={isReadOnly}
          recipientRoomCount={rooms.filter((room) => room.status === "occupied").length}
          rooms={rooms}
        />}
        {activePage === "help" && <HelpPage />}
        {activePage === "properties" && <PropertiesPage activePropertyId={propertyId} properties={availableProperties} />}
        {activePage === "account" && (
          <SettingsPage
            accountEmail={authenticatedEmail ?? ""}
            accountName={currentUser}
            initialSection="account"
            initialSettings={dashboardData.settings}
            onDataChanged={refreshDashboard}
            onAccountNameChange={setCurrentUser}
            propertyId={propertyId}
            readOnly={false}
            rooms={rooms}
            subscription={aggregation?.subscription ?? null}
          />
        )}
        {["settings", "invitations", "subscription"].includes(activePage) && (
          <SettingsPage
            accountEmail={authenticatedEmail ?? ""}
            accountName={currentUser}
            initialSection={activePage === "invitations" ? "invitations" : activePage === "subscription" ? "subscription" : "general"}
            initialSettings={dashboardData.settings}
            onDataChanged={refreshDashboard}
            onAccountNameChange={setCurrentUser}
            propertyId={propertyId}
            readOnly={isReadOnly}
            rooms={rooms}
            subscription={aggregation?.subscription ?? null}
          />
        )}
        </div>
      </section>
      {isRoomModalOpen && selectedRoom && (
        <RoomEditModal
          floorOptions={dashboardData.settings.floorDirectory
            .filter((item) => item.buildingId === selectedRoom.buildingId)
            .map((item) => ({ id: item.id, number: item.number }))}
          furnitureOptions={dashboardData.settings.furnitureOptions}
          onClose={() => setIsRoomModalOpen(false)}
          onSave={saveRoomEdit}
          readOnly={isReadOnly}
          room={selectedRoom}
          tenant={selectedTenant}
        />
      )}
      {isTenantModalOpen && selectedRoom && (
        <TenantEditModal
          mode={tenantModalMode}
          onClose={() => setIsTenantModalOpen(false)}
          onSave={saveTenantEdit}
          room={selectedRoom}
          rooms={rooms}
          tenant={tenantModalMode === "edit" ? selectedTenant : undefined}
        />
      )}
      {detailTenant && (
        <TenantDetailModal
          onClose={() => setDetailTenantId(null)}
          onSave={saveTenantDetail}
          onTransitionCompleted={async (leaseDraft) => {
            setDetailTenantId(null);
            await refreshDashboard();
            if (leaseDraft) {
              const params = new URLSearchParams({
                createLeaseForRoom: leaseDraft.roomId,
                depositAmount: String(leaseDraft.depositAmount),
                monthlyRent: String(leaseDraft.monthlyRent),
                startDate: leaseDraft.startDate,
              });
              router.push(`${ownerPagePath(propertyId, "contracts")}?${params.toString()}`);
            }
          }}
          propertyId={propertyId}
          readOnly={isReadOnly}
          rooms={rooms}
          tenant={detailTenant}
        />
      )}
      <ChatWidget
        propertyId={propertyId}
        readOnly={isReadOnly}
        tenants={tenants}
        unreadCount={aggregation?.operations.unreadTenantMessages ?? 0}
        openSignal={openChatSignal}
      />
    </main>
  );
}
