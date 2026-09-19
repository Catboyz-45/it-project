"use client";
// ถือ state ของทั้งพื้นที่เจ้าของหอ และโหลดข้อมูลใหม่จากเบราว์เซอร์

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
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
  type Complaint,
  HelpPage,
  PropertiesPage,
} from "@/components/dorm/pages/AdditionalPages";
import { ChatWidget } from "@/components/dorm/ChatWidget";
import { InvoicesPage } from "@/components/dorm/pages/InvoicesPage";
import { MetersPage } from "@/components/dorm/pages/MetersPage";
import { OverviewPage } from "@/components/dorm/pages/OverviewPage";
import { ParcelsPage, type ParcelRecord, type ParcelView } from "@/components/dorm/pages/ParcelsPage";
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
import { ownerPageFromSegments, ownerPagePath } from "@/lib/navigation-routes";
import { blocksSubscriptionMutations, resolveSubscriptionUiAccessState } from "@/lib/client/subscription-access-state";
import { platformProfile } from "@/lib/platform-profile";
import { NotificationCenter, type NotificationCenterItem } from "@/components/ui/NotificationCenter";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { PageHeaderSlotProvider, PageHeaderTarget } from "@/components/ui/PageHeaderSlot";
import { OwnerGlobalSearch } from "@/components/dorm/OwnerGlobalSearch";

// สามหน้านี้ไม่มีในเมนูหลัก มิเตอร์อยู่ในเมนูย่อย ส่วนประวัติซ่อมเข้าจากหน้าเรื่องร้องเรียน
type MenuPageKey = Exclude<PageKey, "repairHistory" | "waterMeter" | "electricMeter">;
const menuItems: Array<{ key: MenuPageKey; label: string; icon: ComponentType<{ size?: number }> }> = [
  { key: "overview", label: "แดชบอร์ด", icon: Home },
  { key: "rooms", label: "ผังห้องพัก", icon: Building2 },
  { key: "tenants", label: "ผู้เช่า", icon: UserRound },
  { key: "contracts", label: "สัญญาเช่า", icon: FileText },
];

const secondaryMenuItems: Array<{ key: MenuPageKey; label: string; icon: ComponentType<{ size?: number }> }> = [
  { key: "invoices", label: "บิลและการเงิน", icon: QrCode },
  { key: "complaints", label: "ร้องเรียน", icon: Wrench },
  { key: "parcels", label: "คลังพัสดุ", icon: PackageCheck },
];

// Record บังคับให้ทุกหน้ามีชื่อกำกับตั้งแต่ตอนคอมไพล์ เพิ่มหน้าใหม่แล้วลืมตั้งชื่อจะคอมไพล์ไม่ผ่าน
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

type DashboardProperty = { id: string; name: string; shortName: string; rooms?: number };
// ฐานข้อมูลเก็บ "-" แทนค่าว่างในบางฟิลด์ แปลงกลับเป็น null ก่อนส่งขึ้นเซิร์ฟเวอร์
const optionalTenantText = (value: string) => {
  const normalized = value.trim();
  return normalized && normalized !== "-" ? normalized : null;
};

// สิ่งที่หน้าต่าง ๆ ต้องใช้ร่วมกัน ส่งผ่าน context เพราะเปลือกอยู่ใน layout ส่วนหน้ามาทาง children
// จึงเป็นพี่น้องกันในต้นไม้ React ส่งเป็น prop ตรง ๆ ไม่ได้
type OwnerWorkspaceValue = {
  accountEmail: string;
  accountName: string;
  activeProperty: DashboardProperty;
  aggregation: OwnerDashboardAggregation | null;
  availableProperties: DashboardProperty[];
  dashboardData: OwnerWorkspaceReadModel;
  invoices: Invoice[];
  isReadOnly: boolean;
  isRefreshing: boolean;
  navigateTo: (page: PageKey) => void;
  onAccountNameChange: (name: string) => void;
  onOpenChat: () => void;
  onOpenTenantDetail: (tenant: Tenant) => void;
  onEditRoom: () => void;
  onUnreadChanged: () => Promise<void>;
  openAddComplaint: boolean;
  onAddComplaintHandled: () => void;
  parcelView: ParcelView;
  propertyId: string;
  refreshDashboard: () => Promise<void>;
  repairTickets: OwnerWorkspaceReadModel["repairs"];
  rooms: Room[];
  saveMeters: Parameters<typeof MetersPage>[0]["onSaveMeters"];
  selectedRoom: Room | undefined;
  setSelectedRoomId: (id: string) => void;
  summary: DashboardSummary | null;
  tenants: Tenant[];
};
const OwnerWorkspaceContext = createContext<OwnerWorkspaceValue | null>(null);

// ทุกหน้าอยู่ใต้เปลือกเสมอ ไม่เจอ context แปลว่าประกอบหน้าผิดที่ ต้องรู้ทันทีไม่ใช่ปล่อยให้พังเงียบ
function useOwnerWorkspace() {
  const value = useContext(OwnerWorkspaceContext);
  if (!value) throw new Error("ต้องใช้ภายใน DormDashboard เท่านั้น");
  return value;
}

// เปลือกของทั้งพื้นที่เจ้าของหอ อยู่ใน layout จึงไม่ถูกถอดตอนเปลี่ยนหน้า
// ข้อมูลตั้งต้นของหอจึงโหลดครั้งเดียว ไม่ใช่ทุกครั้งที่กดเมนู
// เพราะหลายหน้าใช้ข้อมูลชุดเดียวกัน และการแก้จากหน้าหนึ่งต้องสะท้อนไปอีกหน้าทันที
export function DormDashboard({
  authenticatedEmail,
  authenticatedUser,
  availableProperties,
  children,
  initialAggregation,
  initialData,
  propertyId,
}: {
  authenticatedEmail?: string;
  authenticatedUser?: string;
  availableProperties: DashboardProperty[];
  children: ReactNode;
  initialAggregation: OwnerDashboardAggregation;
  initialData: OwnerWorkspaceReadModel;
  propertyId: string;
}) {
  const router = useRouter();
  // อ่านหน้าปัจจุบันจาก URL แทนการรับเป็น prop เพราะ layout ไม่รู้พารามิเตอร์ของ route ลูก
  const pathname = usePathname();
  const activePage = ownerPageFromSegments(
    pathname.replace(new RegExp(`^/admin/properties/${propertyId}/?`), "").split("/").filter(Boolean),
  ) ?? "overview";
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
  // หาไม่เจอก็ใช้หอแรกแทน กันหัวข้อว่างเปล่าตอนข้อมูลยังมาไม่ครบ
  const activeProperty = availableProperties.find((property) => property.id === propertyId) ?? availableProperties[0];

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];
  const selectedTenant = selectedRoom ? tenants.find((tenant) => tenant.roomId === selectedRoom.id) : undefined;
  const detailTenant = detailTenantId ? tenants.find((tenant) => tenant.id === detailTenantId) : undefined;
  // สิทธิ์การใช้งานขึ้นกับสถานะแพ็กเกจ ใช้งานเต็ม ช่วงผ่อนผัน หรืออ่านอย่างเดียว
  // ตัวนี้เป็นแค่การซ่อนปุ่มให้ผู้ใช้รู้ตัว ส่วนการบังคับจริงอยู่ที่เซิร์ฟเวอร์ทุกครั้ง
  const accessState = resolveSubscriptionUiAccessState({
    accessMode: aggregation ? aggregation.subscription?.accessMode ?? "READ_ONLY" : null,
    error: accessError,
    isLoading: isRefreshing,
  });
  const isReadOnly = blocksSubscriptionMutations(accessState);
  const isInGracePeriod = accessState === "grace";
  // เตือนล่วงหน้า 30 วัน 86_400_000 คือจำนวนมิลลิวินาทีในหนึ่งวัน
  const isSubscriptionExpiringSoon = Boolean(aggregation?.subscription)
    && new Date(aggregation!.subscription!.expiresAt).getTime() > Date.now()
    && new Date(aggregation!.subscription!.expiresAt).getTime() - Date.now() <= 30 * 86_400_000;
  const readOnlyMessage = "แพ็กเกจหมดอายุแล้ว พื้นที่นี้เปิดให้อ่านข้อมูลเท่านั้น กรุณาต่ออายุแพ็กเกจ";

  // เรียกก่อนทุกการกระทำที่เปลี่ยนข้อมูล คืน false พร้อมขึ้นข้อความบอกเหตุผล
  const ensureWritable = () => {
    if (!isReadOnly) return true;
    setDataError(accessState === "loading" || accessState === "error"
      ? "ยังตรวจสอบสิทธิ์การใช้งานไม่ได้ กรุณาลองโหลดข้อมูลใหม่"
      : readOnlyMessage);
    return false;
  };

  // ทุกหน้ามี URL ของตัวเอง เปลี่ยนหน้าจึงเป็นการเปลี่ยนเส้นทางจริง ไม่ใช่แค่สลับ state
  const navigateTo = useCallback((page: PageKey) => {
    router.push(ownerPagePath(propertyId, page));
  }, [propertyId, router]);

  // โหลดข้อมูลร่วมใหม่ทั้งชุด เรียกหลังทุกการแก้ไข เพื่อให้ทุกหน้าเห็นข้อมูลตรงกัน
  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    setDataError("");
    setAccessError("");
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

  // โหลดใหม่เมื่อสลับไปหออื่น เพราะ refreshDashboard ผูกกับ propertyId อยู่แล้ว
  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const refreshUnreadTicketReplies = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/notifications/unread`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json() as { data?: { ticketReplies: number } };
      if (response.ok && payload.data) setUnreadTicketReplies(payload.data.ticketReplies);
    } catch {
      // ตัวเลขบนป้ายโหลดไม่ได้ก็ไม่เป็นไร ไม่ควรไปขึ้นข้อความผิดพลาดใหญ่ของทั้งหน้า
      // แต่ต้องดักไว้ ไม่งั้นเป็น unhandled rejection
    }
  }, [propertyId]);

  useEffect(() => { void refreshUnreadTicketReplies(); }, [refreshUnreadTicketReplies]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false);
    };
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

  // ป้ายตัวเลขบนเมนู ซ่อนไปเลยเมื่อไม่มีอะไรค้าง
  const menuBadge = (page: PageKey) => {
    const count = notificationCounts[page] ?? 0;
    return count > 0
      ? <span className="notification-badge" aria-label={`${count} รายการ${isReadOnly ? "สำหรับตรวจสอบ" : "ที่ต้องดำเนินการ"}`}>{count > 99 ? "99+" : count}</span>
      : null;
  };

  // รายการในกระดิ่งแจ้งเตือน ข้อความต่างกันตามสิทธิ์ เพราะโหมดอ่านอย่างเดียวทำอะไรต่อไม่ได้
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

  // บันทึกมิเตอร์ทั้งชุดในคำขอเดียว ห้องเยอะจะได้ไม่ต้องยิงทีละห้อง
  const saveMeters = async (readings: Array<{ roomId: string; type: "WATER" | "ELECTRICITY"; billingMonth: string; previousReading?: number; currentReading: number }>) => {
    // โยน error แทนการคืนค่า เพราะหน้าที่เรียกต้องรู้ว่าไม่สำเร็จเพื่อคงร่างไว้ให้ผู้ใช้
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

  // สามหน้านี้ใช้ SettingsPage ร่วมกัน จึงถือเป็นพื้นที่ตั้งค่าเดียวกันทั้งหมด
  // ไม่ว่าจะเข้าจากเมนูตั้งค่าหรือเปิด URL ตรง และใช้โครงหน้าคนละแบบกับหน้าอื่น
  const isSettingsArea = ["settings", "invitations", "subscription"].includes(activePage);

  // PageHeaderSlotProvider เปิดช่องให้หน้าย่อยส่งปุ่มของตัวเองขึ้นมาแสดงบนแถบหัวเรื่อง
  const workspaceValue: OwnerWorkspaceValue = {
    accountEmail: authenticatedEmail ?? "",
    accountName: currentUser,
    activeProperty,
    aggregation,
    availableProperties,
    dashboardData,
    invoices,
    isReadOnly,
    isRefreshing,
    navigateTo,
    onAccountNameChange: setCurrentUser,
    onOpenChat: () => setOpenChatSignal((current) => current + 1),
    onOpenTenantDetail: (tenant) => {
      setTenants((current) => current.some((item) => item.id === tenant.id) ? current : [...current, tenant]);
      setDetailTenantId(tenant.id);
    },
    onEditRoom: () => setIsRoomModalOpen(true),
    onUnreadChanged: refreshUnreadTicketReplies,
    openAddComplaint: shouldOpenComplaintAdd,
    onAddComplaintHandled: () => setShouldOpenComplaintAdd(false),
    parcelView,
    propertyId,
    refreshDashboard,
    repairTickets,
    rooms,
    saveMeters,
    selectedRoom,
    setSelectedRoomId,
    summary,
    tenants,
  };

  return (
    <OwnerWorkspaceContext.Provider value={workspaceValue}>
    <PageHeaderSlotProvider>
    <main className={isSettingsArea ? "shell shell-settings" : "shell"}>
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
                  // สลับหอพักต้องโหลดใหม่ทั้งหน้าโดยตั้งใจ เพื่อทิ้ง state และแคชข้อมูลของหอเดิมให้หมด
                  // ไม่ใช้ router.push() ที่จะพาข้อมูลข้ามหอพักติดไปด้วย
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
          {menuItems.map(({ key, label, icon: Icon }) => (
            <Link className={activePage === key || (activePage === "repairHistory" && key === "complaints") ? "active" : ""} href={ownerPagePath(propertyId, key)} key={key}>
              <Icon size={18} />
              <span>{label}</span>
              {menuBadge(key)}
            </Link>
          ))}
          <div className="sidebar-group">
            <button
              aria-expanded={isMetersMenuOpen}
              onClick={() => setIsMetersMenuOpen((current) => !current)}
              type="button"
            >
              <Gauge size={18} />
              <span>ค่าน้ำและค่าไฟ</span>
              <ChevronDown className={isMetersMenuOpen ? "sidebar-chevron open" : "sidebar-chevron"} size={17} />
            </button>
            {/* คงไว้ใน DOM เสมอแล้วสลับคลาสแทนการถอดออก ไม่งั้นความสูงกระโดดทันทีจนไม่มีอะไรให้ค่อย ๆ กาง */}
            <div aria-hidden={!isMetersMenuOpen} className={isMetersMenuOpen ? "sidebar-subnav open" : "sidebar-subnav"}>
              <div>
                {/* ปิดอยู่ก็ต้องกด Tab ข้ามไป ไม่งั้นโฟกัสจะหายเข้าไปในเมนูที่มองไม่เห็น */}
                <Link className={activePage === "waterMeter" ? "active" : ""} href={ownerPagePath(propertyId, "waterMeter")} tabIndex={isMetersMenuOpen ? undefined : -1}>
                  <Droplets size={17} />
                  <span>มิเตอร์น้ำ</span>
                </Link>
                <Link className={activePage === "electricMeter" ? "active" : ""} href={ownerPagePath(propertyId, "electricMeter")} tabIndex={isMetersMenuOpen ? undefined : -1}>
                  <Zap size={17} />
                  <span>มิเตอร์ไฟ</span>
                </Link>
              </div>
            </div>
          </div>
          {secondaryMenuItems.map(({ key, label, icon: Icon }) => (
            <Link className={activePage === key || (activePage === "repairHistory" && key === "complaints") ? "active" : ""} href={ownerPagePath(propertyId, key)} key={key}>
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
                  // ออกจากระบบต้องโหลดใหม่ทั้งหน้า เพื่อทิ้ง state และแคช RSC ของผู้ใช้เดิมทั้งหมด
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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

      <section className={`${isSettingsArea ? "workspace settings-workspace" : "workspace"}${isReadOnly ? " workspace-read-only" : ""}`}>
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
        {!isSettingsArea ? (
          <header className="topbar">
            <div>
              <h1>{pageTitles[activePage].title}</h1>
              <p className="page-subtitle">{pageTitles[activePage].subtitle}</p>
            </div>
            <div className="top-actions repair-top-actions">
              <PageHeaderTarget />
              <OwnerGlobalSearch propertyId={propertyId} />
              <NotificationCenter isLoading={isRefreshing} items={ownerNotifications} onRefresh={async () => { await Promise.all([refreshDashboard(), refreshUnreadTicketReplies()]); }} readOnly={accessState === "read-only"} storageKey={`owner-notifications:${propertyId}`} />
            </div>
          </header>
        ) : null}
        {/* เนื้อของหน้ามาจาก page ของ route นั้น เปลี่ยนหน้าจึงเปลี่ยนเฉพาะตรงนี้ เปลือกอยู่เหมือนเดิม */}
        <div className="view-transition">{children}</div>
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
    </PageHeaderSlotProvider>
    </OwnerWorkspaceContext.Provider>
  );
}

// เนื้อของหน้าหนึ่งหน้า page ของแต่ละ route เรียกตัวนี้พร้อมบอกว่าเป็นหน้าอะไร
// ข้อมูลร่วมหยิบจาก context ที่เปลือกเตรียมไว้ จึงไม่ต้องโหลดซ้ำตอนเปลี่ยนหน้า
// ข้อมูลตั้งต้นที่ Server Component ของแต่ละหน้าดึงมาให้ หน้าไหนไม่ได้ส่งมาก็โหลดเองเหมือนเดิม
export type OwnerInitialParcels = {
  hasNextPage: boolean;
  items: ParcelRecord[];
  summary: { today: number; waiting: number; received: number; olderThanThreeDays: number };
};

export function OwnerSectionPanel({
  initialLeases = null,
  initialParcels = null,
  initialRepairHistory = null,
  initialTenants = null,
  initialComplaints = null,
  initialInvitations = null,
  initialSubscriptionData = null,
  invoiceView = "invoices",
  page,
}: {
  initialLeases?: { data: unknown[]; pageInfo: { page: number; pageSize: number; hasNextPage: boolean } } | null;
  initialParcels?: OwnerInitialParcels | null;
  initialRepairHistory?: { pageInfo: { page: number; pageSize: number; hasNextPage: boolean }; tickets: OwnerWorkspaceReadModel["repairs"] } | null;
  initialTenants?: { data: Tenant[]; pageInfo: { page: number; pageSize: number; hasNextPage: boolean } } | null;
  initialComplaints?: Complaint[] | null;
  initialInvitations?: Parameters<typeof SettingsPage>[0]["initialInvitations"];
  initialSubscriptionData?: Parameters<typeof SettingsPage>[0]["initialSubscriptionData"];
  invoiceView?: "invoices" | "payments";
  page: PageKey;
}) {
  const workspace = useOwnerWorkspace();
  const {
    accountEmail, accountName, activeProperty, aggregation, availableProperties, dashboardData,
    invoices, isReadOnly, isRefreshing, navigateTo, onAccountNameChange, onAddComplaintHandled,
    onEditRoom, onOpenChat, onOpenTenantDetail, onUnreadChanged, openAddComplaint, parcelView,
    propertyId, refreshDashboard, repairTickets, rooms, saveMeters, selectedRoom, setSelectedRoomId,
    summary, tenants,
  } = workspace;

  if (page === "overview") {
    // ตัวเลขสรุปมาจากคนละคำสั่งกับข้อมูลหลัก จึงพลาดได้เองโดยที่หน้าอื่นยังใช้ได้ปกติ
    if (!summary || !aggregation) {
      return <div className="dashboard-empty-state" role="alert">
        <p>{isRefreshing ? "กำลังโหลดข้อมูลสรุป..." : "ไม่สามารถโหลดข้อมูลสรุปจากระบบได้"}</p>
        {!isRefreshing ? <RetryButton label="ลองโหลดข้อมูลสรุปใหม่" onClick={() => void refreshDashboard()} /> : null}
      </div>;
    }
    return <OverviewPage
      aggregation={aggregation}
      invoices={invoices}
      onOpenChat={onOpenChat}
      readOnly={isReadOnly}
      rooms={rooms}
      setActivePage={navigateTo}
      summary={summary}
      tenants={tenants}
    />;
  }
  if (page === "rooms") {
    return <RoomsPage
      invoices={invoices}
      onEditRoom={onEditRoom}
      readOnly={isReadOnly}
      rooms={rooms}
      selectedRoom={selectedRoom}
      setSelectedRoomId={setSelectedRoomId}
    />;
  }
  if (page === "tenants") {
    return <TenantsPage
      filteredTenants={initialTenants?.data ?? tenants}
      initialPageInfo={initialTenants?.pageInfo ?? null}
      onChanged={refreshDashboard}
      onOpenTenantDetail={onOpenTenantDetail}
      propertyId={propertyId}
      readOnly={isReadOnly}
      setSelectedRoomId={setSelectedRoomId}
    />;
  }
  if (page === "contracts") {
    return <ContractsPage
      initialLeases={initialLeases?.data as Parameters<typeof ContractsPage>[0]["initialLeases"] ?? null}
      initialPageInfo={initialLeases?.pageInfo ?? null}
      propertyId={propertyId}
      propertyName={activeProperty.name}
      readOnly={isReadOnly}
      rooms={rooms}
    />;
  }
  if (page === "waterMeter" || page === "electricMeter") {
    return <MetersPage
      mode={page === "waterMeter" ? "water" : "electric"}
      onSaveMeters={saveMeters}
      propertyId={propertyId}
      readOnly={isReadOnly}
    />;
  }
  if (page === "invoices") return <InvoicesPage initialView={invoiceView} invoices={invoices} onChanged={refreshDashboard} propertyId={propertyId} propertyName={activeProperty.name} readOnly={isReadOnly} rooms={rooms} />;
  if (page === "repairHistory") {
    return <RepairHistoryPage
      initialPageInfo={initialRepairHistory?.pageInfo ?? null}
      propertyId={propertyId}
      tickets={initialRepairHistory?.tickets ?? repairTickets}
    />;
  }
  if (page === "complaints") {
    return <ComplaintsPage
      complaints={initialComplaints ?? dashboardData.complaints}
      initialLoaded={initialComplaints !== null}
      onAddRequestHandled={onAddComplaintHandled}
      onChanged={refreshDashboard}
      onUnreadChanged={onUnreadChanged}
      openAddOnMount={openAddComplaint}
      propertyId={propertyId}
      readOnly={isReadOnly}
    />;
  }
  if (page === "parcels") {
    return <ParcelsPage
      activeView={parcelView}
      initialHasNextPage={initialParcels?.hasNextPage ?? false}
      initialParcels={initialParcels?.items ?? dashboardData.parcels}
      initialSummary={initialParcels?.summary ?? null}
      onChanged={refreshDashboard}
      propertyId={propertyId}
      readOnly={isReadOnly}
      rooms={rooms}
    />;
  }
  if (page === "announcements") {
    // ประกาศไม่ได้ดึงจากเซิร์ฟเวอร์ เพราะการแปลงต้องจับคู่เลขห้องกับรหัสห้องจาก rooms ฝั่งนี้
    // ซึ่ง Server Component ของหน้าไม่มีให้ ต้องยิงถามเพิ่มจนได้ไม่คุ้มเสีย
    return <AnnouncementsPage
      initialAnnouncements={dashboardData.announcements}
      onChanged={refreshDashboard}
      propertyId={propertyId}
      readOnly={isReadOnly}
      recipientRoomCount={rooms.filter((room) => room.status === "occupied").length}
      rooms={rooms}
    />;
  }
  if (page === "help") return <HelpPage />;
  if (page === "properties") return <PropertiesPage activePropertyId={propertyId} properties={availableProperties} />;
  // หน้าบัญชีกับหน้าตั้งค่าใช้คอมโพเนนต์เดียวกัน ต่างกันที่เปิดมาที่หัวข้อไหนและแก้ได้แค่ไหน
  // บัญชีเป็นข้อมูลของตัวผู้ใช้เอง จึงแก้ได้แม้หอจะอยู่ในโหมดอ่านอย่างเดียว
  if (page === "account" || page === "settings" || page === "invitations" || page === "subscription") {
    return <SettingsPage
      accountEmail={accountEmail}
      accountName={accountName}
      initialInvitations={initialInvitations}
      initialSubscriptionData={initialSubscriptionData}
      initialSection={page === "account" ? "account" : page === "invitations" ? "invitations" : page === "subscription" ? "subscription" : "general"}
      initialSettings={dashboardData.settings}
      onAccountNameChange={onAccountNameChange}
      onDataChanged={refreshDashboard}
      propertyId={propertyId}
      readOnly={page === "account" ? false : isReadOnly}
      rooms={rooms}
      subscription={aggregation?.subscription ?? null}
    />;
  }
  return null;
}
