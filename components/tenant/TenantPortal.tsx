"use client";
// ถือ state ของทั้งพื้นที่ผู้เช่า และโหลดข้อมูลใหม่จากเบราว์เซอร์

import Image from "next/image";
import Link from "next/link";
import { AppSection } from "@/components/ui/AppSection";
import { IconButton } from "@/components/ui/IconButton";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { usePathname, useRouter } from "next/navigation";
import { SyntheticEvent, Fragment, ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Clock3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Gauge,
  Home,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  MoreHorizontal,
  Package,
  Paperclip,
  QrCode,
  ReceiptText,
  Send,
  Upload,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { TicketReplyThread } from "@/components/dorm/TicketReplyThread";
import { DropdownField } from "@/components/dorm/DropdownField";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { LoadMoreButton, RetryButton } from "@/components/ui/DataNavigation";
import { useChatThread } from "@/components/chat/use-chat-thread";
import { WindowOptionsMenu } from "@/components/chat/ChatParts";
import { Dialog } from "@/components/ui/Dialog";
import { PlatformBrand } from "@/components/ui/PlatformBrand";
import { NotificationCenter, type NotificationCenterItem } from "@/components/ui/NotificationCenter";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { SidebarAccountMenu } from "@/components/ui/SidebarAccountMenu";
import { useToast } from "@/components/ui/ToastProvider";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";
import { formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { currency } from "@/lib/dorm-utils";
import { formatStatus } from "@/lib/ui-labels";
import { Empty, Info, InfoCard, Panel, Status } from "@/components/tenant/primitives";
import { tenantPagePath, tenantTabFromSegments, type TenantTab } from "@/lib/navigation-routes";
import { blocksSubscriptionMutations, resolveSubscriptionUiAccessState, type SubscriptionUiAccessState } from "@/lib/client/subscription-access-state";
import type { TenantRecordView } from "@/lib/tenant-record-view";
import { PrivacyPreferencesPanel } from "@/components/legal/PrivacyPreferencesPanel";
import { PageHeaderActions, PageHeaderSlotProvider, PageHeaderTarget } from "@/components/ui/PageHeaderSlot";
import { listAnnouncement } from "@/components/tenant/LoadMoreList";

// บัญชีผู้เช่าหนึ่งคน คนหนึ่งอาจมีหลายการเข้าพัก เช่นย้ายห้องหรือเช่าหลายห้อง
type Account = {
  id: string;
  phone: string;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  user: { displayName: string; email: string };
  // เก็บทุกสถานะ ไม่ใช่แค่ที่ยังใช้งานอยู่ เพราะต้องใช้บอกว่ากำลังรออนุมัติหรือถูกปฏิเสธ
  occupancies: Array<{
    id: string;
    role: "PRIMARY" | "CO_OCCUPANT";
    status: "PENDING" | "ACTIVE" | "ENDED" | "REJECTED";
    startedAt: string | Date | null;
    endedAt: string | Date | null;
    room: { number: string };
    property: { id: string; name: string; shortName: string; isActive: boolean };
  }>;
};
type RoomData = {
  role: "PRIMARY" | "CO_OCCUPANT";
  startedAt: string | null;
  room: {
    id: string; number: string; roomType: string; monthlyRent: string; capacity: number; status: string;
    furniture: unknown;
    building: { name: string; code: string };
    floor: { number: number; label: string | null };
    property: {
      id: string; name: string; shortName: string;
      settings: {
        address: string; contactPhone: string; contactEmail: string | null;
        houseRules: string | null; emergencyContact: string | null;
      } | null;
    };
  };
};
// ตัวเลขงานค้างทั้งหมดในคำขอเดียว ไม่ต้องยิงถามทีละหน้า
type TenantNotificationSummary = {
  unpaidInvoices: number;
  waitingParcels: number;
  openTickets: number;
  unreadMessages: number;
  unreadTicketReplies: number;
  // แพ็กเกจเป็นของหอ ไม่ใช่ของผู้เช่า แต่หอหมดอายุแล้วผู้เช่าก็ทำรายการไม่ได้เหมือนกัน
  subscriptionAccess: {
    mode: "FULL" | "GRACE" | "READ_ONLY";
    isReadOnly: boolean;
    graceEndsAt: string | null;
  };
};

// เก็บเป็นข้อมูล จะได้วนสร้างเมนูได้เลย และเพิ่มหน้าใหม่โดยไม่ต้องแก้ JSX
const tabs: Array<{ id: TenantTab; label: string; icon: typeof Home }> = [
  { id: "home", label: "หน้าหลัก", icon: Home },
  { id: "invoices", label: "บิลและชำระเงิน", icon: ReceiptText },
  { id: "lease", label: "สัญญา", icon: FileText },
  { id: "announcements", label: "ประกาศ", icon: Bell },
  { id: "parcels", label: "พัสดุ", icon: Package },
  { id: "tickets", label: "แจ้งเรื่อง", icon: Wrench },
  { id: "chat", label: "ติดต่อหอ", icon: MessageSquare },
  { id: "account", label: "บัญชีของฉัน", icon: UserRound },
];

// Record บังคับให้ทุกหน้ามีคำอธิบายตั้งแต่ตอนคอมไพล์ เพิ่มหน้าใหม่แล้วลืมจะคอมไพล์ไม่ผ่าน
const tabDescriptions: Record<TenantTab, string> = {
  home: "ภาพรวมข้อมูลสำคัญและงานที่ต้องดำเนินการ",
  invoices: "ตรวจสอบบิล กำหนดชำระ และประวัติการชำระเงิน",
  lease: "ดูรายละเอียดและเอกสารสัญญาเช่าของคุณ",
  announcements: "ติดตามข่าวสารและประกาศล่าสุดจากหอพัก",
  parcels: "ตรวจสอบพัสดุที่รอรับและประวัติการรับพัสดุ",
  tickets: "แจ้งปัญหาและติดตามสถานะการดำเนินงาน",
  chat: "ติดต่อและพูดคุยกับผู้ดูแลหอพัก",
  account: "จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี",
};

// แถบล่างบนมือถือใส่ได้แค่ 4 ช่อง จึงเลือกเฉพาะที่ใช้บ่อย ที่เหลือไปอยู่ในเมนูเพิ่มเติม
const mobilePrimaryTabs = tabs.filter(({ id }) => ["home", "invoices", "parcels", "tickets"].includes(id));
// แชทกับบัญชีไม่อยู่ในเมนูหลักของจอกว้าง เพราะมีปุ่มของตัวเองอยู่แล้ว
const navigationTabs = tabs.filter(({ id }) => !["chat", "account"].includes(id));
const mobileMoreTabs = tabs.filter(({ id }) => ["lease", "announcements", "account"].includes(id));

// ห่อ readApiData ไว้ให้ข้อความผิดพลาดของทั้งไฟล์นี้เหมือนกันหมด
async function apiData<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

// โหลดข้อมูลชุดเดียวจาก URL พร้อมจัดการสถานะโหลดกับข้อผิดพลาดให้ครบ
// enabled=false ใช้ตอนยังไม่มีการเข้าพักที่ใช้งานอยู่ จะได้ไม่ยิงคำขอที่ยังไงก็ถูกปฏิเสธ
// initialData มาจาก Server Component ของหน้านั้น ข้อมูลจึงมาพร้อม HTML
// ไม่ต้องขึ้นสถานะโหลด และไม่ต้องยิงซ้ำตอน mount เพราะเป็นข้อมูลชุดเดียวกัน
function useApiResource<T>(url: string, enabled = true, initialData: T | null = null) {
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(enabled && initialData === null);
  const skipInitialLoadRef = useRef(initialData !== null);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal });
      setData(await apiData<T>(response));
    } catch (loadError) {
      // เบราว์เซอร์อาจยกเลิกคำขอแล้วโยน TypeError แทน AbortError จึงต้องเช็ค signal ด้วย
      if (signal?.aborted || (loadError instanceof DOMException && loadError.name === "AbortError")) return;
      setError(formatClientError(loadError, "โหลดข้อมูลไม่สำเร็จ"));
    } finally {
      // คำขอที่ถูกยกเลิกจะมีคำขอรอบใหม่ตามมาเสมอ ถ้าปิด loading ตรงนี้ UI จะเห็นเป็น
      // "ไม่ได้โหลดอยู่ แต่ไม่มีข้อมูล" แล้วสรุปว่าโหลดล้มเหลว/ตรวจสิทธิ์ไม่ได้ชั่วขณะ
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [enabled, url]);
  useEffect(() => {
    // ได้ข้อมูลมาพร้อมหน้าแล้ว ยิงซ้ำตอน mount คือทำงานเดิมสองรอบ
    // ต้องการของใหม่เมื่อไหร่ค่อยเรียก reload() เอง เช่นหลังบันทึกอะไรสักอย่าง
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return { data, error, isLoading, reload: load };
}

type PaginatedResource<T> = {
  data: T[];
  error: string;
  hasNextPage: boolean;
  total: number | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
};

// แบบเดียวกันแต่โหลดทีละหน้า และต่อท้ายเมื่อกดโหลดเพิ่ม
// initialPage มาจาก Server Component ของหน้านั้น หน้าแรกจึงมาพร้อม HTML
// ไม่ต้องขึ้น skeleton และไม่ต้องยิงซ้ำตอน mount
export type InitialPage<T> = { data: T[]; hasNextPage: boolean; total: number | null };
// enabled=false ใช้กับแท็บที่ยังไม่ได้เปิด จะได้ไม่โหลดข้อมูลที่ผู้ใช้ยังไม่ได้ขอดู
function usePaginatedResource<T>(url: string, pageSize = 20, initialPage: InitialPage<T> | null = null, enabled = true): PaginatedResource<T> {
  const [data, setData] = useState<T[]>(initialPage?.data ?? []);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(initialPage?.hasNextPage ?? false);
  const [total, setTotal] = useState<number | null>(initialPage?.total ?? null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(enabled && initialPage === null);
  const skipInitialPageRef = useRef(initialPage !== null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const requestPage = useCallback(async (targetPage: number, replace: boolean, signal?: AbortSignal) => {
    if (replace) setIsLoading(true);
    else setIsLoadingMore(true);
    setError("");
    try {
      // บาง URL มีพารามิเตอร์มาแล้ว ต้องเลือกตัวคั่นให้ถูก
      const separator = url.includes("?") ? "&" : "?";
      const response = await fetch(`${url}${separator}page=${targetPage}&pageSize=${pageSize}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      const payload = await response.json() as {
        data?: T[];
        error?: string;
        pageInfo?: { hasNextPage: boolean; page: number; total?: number };
      };
      if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
      setData((current) => replace ? payload.data! : [...current, ...payload.data!]);
      setPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
      setTotal(payload.pageInfo.total ?? null);
    } catch (loadError) {
      // คำขอที่ถูกยกเลิกเพราะเปลี่ยนหน้า/unmount ไม่ใช่ความล้มเหลวของการโหลด
      // ถ้าตั้งเป็น error จะขึ้นแบนเนอร์ "โหลดไม่สำเร็จ" ทั้งที่คำขอรอบใหม่กำลังมาแทน
      if (signal?.aborted || (loadError instanceof DOMException && loadError.name === "AbortError")) return;
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [pageSize, url]);

  const reload = useCallback(() => requestPage(1, true), [requestPage]);
  const loadMore = useCallback(() => requestPage(page + 1, false), [page, requestPage]);
  useEffect(() => {
    // ยังไม่เปิดแท็บนี้ก็ยังไม่ต้องโหลด รอจนกดค่อยยิง
    if (!enabled) return;
    // หน้าแรกมาพร้อม HTML แล้ว ยิงซ้ำตอน mount คือทำงานเดิมสองรอบ
    if (skipInitialPageRef.current) {
      skipInitialPageRef.current = false;
      return;
    }
    const controller = new AbortController();
    void requestPage(1, true, controller.signal);
    return () => controller.abort();
  }, [enabled, requestPage]);
  return { data, error, hasNextPage, isLoading, isLoadingMore, loadMore, reload, total };
}

// สิ่งที่แท็บต้องใช้ร่วมกัน ส่งผ่าน context เพราะเปลือกอยู่ใน layout ส่วนแท็บมาทาง children
// จึงเป็นพี่น้องกันในต้นไม้ React ส่งเป็น prop ตรง ๆ ไม่ได้
type TenantPortalValue = {
  account: Account;
  accessState: ReturnType<typeof resolveSubscriptionUiAccessState>;
  active: Account["occupancies"][number] | undefined;
  isPrimary: boolean;
  isReadOnly: boolean;
  notificationResource: ReturnType<typeof useApiResource<TenantNotificationSummary>>;
  roomResource: ReturnType<typeof useApiResource<RoomData>>;
  setAccount: (account: Account) => void;
  refreshAccount: () => Promise<void>;
};
const TenantPortalContext = createContext<TenantPortalValue | null>(null);

// แท็บทุกอันอยู่ใต้เปลือกเสมอ ไม่เจอ context แปลว่าประกอบหน้าผิดที่ ต้องรู้ทันทีไม่ใช่ปล่อยให้พังเงียบ
function useTenantPortal() {
  const value = useContext(TenantPortalContext);
  if (!value) throw new Error("ต้องใช้ภายใน TenantPortal เท่านั้น");
  return value;
}

// เปลือกของทั้งพื้นที่ผู้เช่า อยู่ใน layout จึงไม่ถูกถอดตอนเปลี่ยนแท็บ
// ข้อมูลร่วมอย่างห้องและยอดแจ้งเตือนจึงโหลดครั้งเดียว ไม่ใช่ทุกครั้งที่กดเมนู
// ตัวเลขบนป้ายของแต่ละแท็บ หน้าหลักรวมทุกอย่าง ส่วนแท็บอื่นนับเฉพาะของตัวเอง
function tabNotificationCount(tab: TenantTab, summary: TenantNotificationSummary | null) {
  if (!summary) return 0;
  if (tab === "invoices") return summary.unpaidInvoices;
  if (tab === "parcels") return summary.waitingParcels;
  // มีคำตอบใหม่ให้โชว์จำนวนคำตอบก่อน เพราะเป็นเรื่องที่ต้องเข้าไปอ่าน ไม่ใช่แค่รออยู่
  if (tab === "tickets") return summary.unreadTicketReplies || summary.openTickets;
  if (tab === "chat") return summary.unreadMessages;
  if (tab === "home") {
    return summary.unpaidInvoices + summary.waitingParcels + summary.openTickets + summary.unreadMessages + summary.unreadTicketReplies;
  }
  return 0;
}

// รายการในกระดิ่งแจ้งเตือนของผู้เช่า ไม่มีข้อมูลสรุปก็ยังไม่มีอะไรให้แจ้ง
function buildTenantNotifications(summary: TenantNotificationSummary | null): NotificationCenterItem[] {
  if (!summary) return [];
  return [
    { id: "unpaid-invoices", count: summary.unpaidInvoices, title: "บิลที่รอชำระ", description: "ตรวจสอบยอดและกำหนดชำระของบิลล่าสุด", href: tenantPagePath("invoices"), icon: <ReceiptText size={19} /> },
    { id: "waiting-parcels", count: summary.waitingParcels, title: "มีพัสดุรอรับ", description: "ติดต่อหอพักเพื่อรับพัสดุของคุณ", href: tenantPagePath("parcels"), icon: <Package size={19} /> },
    { id: "open-tickets", count: summary.openTickets, title: "เรื่องแจ้งที่กำลังดำเนินการ", description: "ติดตามสถานะงานซ่อมหรือเรื่องร้องเรียน", href: tenantPagePath("tickets"), icon: <Wrench size={19} /> },
    { id: "ticket-replies", count: summary.unreadTicketReplies, title: "มีคำตอบใหม่ในเรื่องแจ้ง", description: "เปิดอ่านคำตอบล่าสุดจากผู้ดูแลหอ", href: tenantPagePath("tickets"), icon: <MessageSquare size={19} /> },
    { id: "messages", count: summary.unreadMessages, title: "ข้อความใหม่จากหอพัก", description: "เปิดอ่านข้อความจากผู้ดูแลหอ", href: tenantPagePath("chat"), icon: <MessageSquare size={19} /> },
  ];
}

// ลิงก์หนึ่งอันในเมนูด้านข้าง พร้อมป้ายจำนวนที่ต้องตรวจสอบ
function TenantNavLink({ count, icon, isActive, label, tab }: Readonly<{
  count: number;
  icon: ReactNode;
  isActive: boolean;
  label: string;
  tab: TenantTab;
}>) {
  return <Link aria-current={isActive ? "page" : undefined} className={isActive ? "active" : ""} href={tenantPagePath(tab)}>
    {icon}{label}
    {count > 0 ? <span aria-label={`${count} รายการที่ต้องตรวจสอบ`} className="notification-badge">{count > 99 ? "99+" : count}</span> : null}
  </Link>;
}

// แถบบอกสถานะสิทธิ์การใช้งานของหอ แสดงได้ทีละกรณีเท่านั้น
function TenantAccessBanner({ accessState, onRetry }: Readonly<{
  accessState: SubscriptionUiAccessState;
  onRetry: () => void;
}>) {
  if (accessState === "loading") {
    return <output className="subscription-access-banner grace mx-auto mt-5 max-w-[1400px]">
      <span><LoaderCircle aria-hidden="true" className="animate-spin" /></span>
      <div>
        <strong>กำลังตรวจสอบสิทธิ์การใช้งาน</strong>
        <p>ระบบปิดการส่งข้อมูลใหม่ไว้ชั่วคราวระหว่างตรวจสอบสถานะแพ็กเกจ</p>
      </div>
    </output>;
  }
  if (accessState === "error") {
    return <div className="subscription-access-banner grace mx-auto mt-5 max-w-[1400px]" role="alert">
      <span><AlertCircle aria-hidden="true" /></span>
      <div>
        <strong>ยังตรวจสอบสิทธิ์การใช้งานไม่ได้</strong>
        <p>ระบบปิดการส่งข้อมูลใหม่ไว้ชั่วคราว กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p>
      </div>
      <button className="primary-button" onClick={onRetry} type="button">ลองตรวจสอบใหม่</button>
    </div>;
  }
  if (accessState === "read-only") {
    return <div className="subscription-access-banner read-only mx-auto mt-5 max-w-[1400px]" role="alert">
      <span><AlertCircle aria-hidden="true" /></span>
      <div>
        <strong>หอพักนี้อยู่ในโหมดอ่านอย่างเดียว</strong>
        <p>คุณยังดูห้อง บิล สัญญา ประกาศ พัสดุ และประวัติเดิมได้ แต่ยังส่งสลิป แจ้งเรื่อง หรือส่งข้อความใหม่ไม่ได้</p>
      </div>
    </div>;
  }
  return null;
}

// บนมือถือพื้นที่แคบ สองแท็บนี้จึงใช้คำสั้นกว่าบนเมนูปกติ
const mobileTabLabels: Partial<Record<TenantTab, string>> = {
  invoices: "บิล",
  tickets: "แจ้งเรื่อง",
};

export function TenantPortal({
  children,
  initialAccount,
  initialSelectedOccupancyId,
}: Readonly<{
  children: ReactNode;
  initialAccount: Account;
  initialSelectedOccupancyId: string | null;
}>) {
  const router = useRouter();
  // อ่านแท็บจาก URL แทนการรับเป็น prop เพราะ layout ไม่รู้พารามิเตอร์ของ route ลูก
  const pathname = usePathname();
  const activeTab = tenantTabFromSegments(pathname.replace(/^\/tenant\/?/, "").split("/").filter(Boolean)) ?? "home";
  const [account, setAccount] = useState(initialAccount);
  const [selectedOccupancyId, setSelectedOccupancyId] = useState(initialSelectedOccupancyId);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isQuickChatOpen, setIsQuickChatOpen] = useState(false);
  // ต้องเช็คสถานะด้วย ไม่ใช่เทียบแค่ id เพราะห้องที่เลือกไว้อาจย้ายออกไปแล้ว
  const active = account.occupancies.find((item) => item.id === selectedOccupancyId && item.status === "ACTIVE");
  const roomResource = useApiResource<RoomData>("/api/v1/tenant/room", Boolean(active));
  const notificationResource = useApiResource<TenantNotificationSummary>(
    "/api/v1/tenant/notifications/summary",
    Boolean(active),
  );
  // ผู้เช่าหลักเท่านั้นที่เห็นบิลกับสัญญา ผู้พักร่วมเห็นแค่ข้อมูลห้องและเรื่องทั่วไป
  const primary = active?.role === "PRIMARY";
  const accessState = resolveSubscriptionUiAccessState({
    accessMode: notificationResource.data?.subscriptionAccess.mode,
    enabled: Boolean(active),
    error: notificationResource.error,
    isLoading: notificationResource.isLoading,
  });
  // เป็นแค่การซ่อนปุ่มให้ผู้ใช้รู้ตัว ส่วนการบังคับจริงอยู่ที่เซิร์ฟเวอร์ทุกครั้ง
  const isReadOnly = blocksSubscriptionMutations(accessState);
  const notificationCount = (tab: TenantTab) => tabNotificationCount(tab, notificationResource.data);
  const tenantNotifications = buildTenantNotifications(notificationResource.data);
  // สลับห้องที่กำลังดู เซิร์ฟเวอร์เก็บไว้ในคุกกี้เพื่อให้เปิดครั้งหน้ายังอยู่ห้องเดิม
  const switchOccupancy = async (occupancyId: string) => {
    setIsSwitching(true);
    try {
      await apiData(await fetch("/api/v1/tenant/occupancy-selection", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupancyId }),
      }));
      setSelectedOccupancyId(occupancyId);
      setIsQuickChatOpen(false);
      // โหลดข้อมูลห้องกับตัวเลขแจ้งเตือนใหม่พร้อมกัน เพราะเป็นคนละห้องแล้ว
      await Promise.all([roomResource.reload(), notificationResource.reload()]);
      // กลับหน้าหลักเพราะหน้าที่ดูอยู่อาจไม่มีในห้องใหม่ เช่นผู้พักร่วมไม่มีหน้าบิล
      router.push(tenantPagePath("home"));
      // refresh ให้ส่วนที่วาดจากฝั่งเซิร์ฟเวอร์อัปเดตตามคุกกี้ที่เพิ่งเปลี่ยน
      router.refresh();
    } finally {
      setIsSwitching(false);
    }
  };
  const refreshAccount = async () => {
    const updated = await apiData<Account>(await fetch("/api/v1/tenant/me", {
      cache: "no-store",
      credentials: "same-origin",
    }));
    setAccount(updated);
  };

  const activeTabItem = tabs.find(({ id }) => id === activeTab) ?? tabs[0];

  const portalValue: TenantPortalValue = {
    account, accessState, active, isPrimary: primary, isReadOnly,
    notificationResource, roomResource, setAccount, refreshAccount,
  };

  return <TenantPortalContext.Provider value={portalValue}><PageHeaderSlotProvider>
    <main className="tenant-portal tenant-shell shell text-[#292a30]">
    <LiveAnnouncement message={`เปิดหน้า ${tabs.find(({ id }) => id === activeTab)?.label ?? "พื้นที่ผู้เช่า"}`} />
    <aside className="sidebar tenant-sidebar">
      <div className="brand tenant-brand">
        <PlatformBrand className="[&_small]:text-[#62646c] [&_strong]:text-base" context="Tenant" imageClassName="size-11" showTagline />
      </div>
      <p className="tenant-sidebar-property">{active?.property.name ?? "พื้นที่ผู้เช่า"}</p>
      <nav aria-label="เมนูผู้เช่า">
        {navigationTabs.map(({ id, icon: Icon, label }) => (
          <TenantNavLink count={notificationCount(id)} icon={<Icon size={19} />} isActive={activeTab === id} key={id} label={label} tab={id} />
        ))}
      </nav>
      <SidebarAccountMenu
        contextLabel={active?.property.shortName ?? "พื้นที่ผู้เช่า"}
        displayName={account.user.displayName}
        email={account.user.email}
        role="TENANT"
      />
    </aside>
    <section className="workspace tenant-workspace">
      <header className="topbar tenant-topbar">
        <div>
          <h1>{activeTabItem.label}</h1>
          <p className="page-subtitle">{tabDescriptions[activeTab]}</p>
        </div>
        <div className="tenant-header-actions flex items-center gap-3">
          <PageHeaderTarget />
          {active ? <NotificationCenter isLoading={notificationResource.isLoading} items={tenantNotifications} onRefresh={notificationResource.reload} readOnly={accessState === "read-only"} storageKey={`tenant-notifications:${active.id}`} /> : null}
          {account.occupancies.some(({ status }) => status === "ACTIVE") ? <DropdownField
            disabled={isSwitching}
            label="เลือกการเข้าพัก"
            onChange={(value) => void switchOccupancy(value)}
            options={account.occupancies.filter(({ status }) => status === "ACTIVE").map((occupancy) => ({ label: `${occupancy.property.shortName} · ห้อง ${occupancy.room.number}`, value: occupancy.id }))}
            value={active?.id ?? ""}
          /> : null}
        </div>
      </header>
    <TenantAccessBanner accessState={accessState} onRetry={() => void notificationResource.reload()} />
    {/* เนื้อของแท็บมาจาก page ของ route นั้น เปลี่ยนแท็บจึงเปลี่ยนเฉพาะตรงนี้ เปลือกอยู่เหมือนเดิม */}
    <div className="tenant-content mx-auto max-w-[1500px] px-6 py-6">
      <section className="min-w-0">{children}</section>
    </div>
    </section>
    <nav aria-label="เมนูผู้เช่าบนมือถือ" className="tenant-mobile-navigation">
      {mobilePrimaryTabs.map(({ id, icon: Icon, label }) => (
        <Link aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "active" : ""} href={tenantPagePath(id)} key={id}>
          <span className="tenant-mobile-nav-icon">
            <Icon aria-hidden="true" size={21} />
            {notificationCount(id) > 0 ? <span className="tenant-mobile-nav-badge">{notificationCount(id) > 99 ? "99+" : notificationCount(id)}</span> : null}
          </span>
          <span>{mobileTabLabels[id] ?? label}</span>
        </Link>
      ))}
      <details className="tenant-mobile-more">
        <summary className={mobileMoreTabs.some(({ id }) => id === activeTab) ? "active" : ""}>
          <span className="tenant-mobile-nav-icon">
            <MoreHorizontal aria-hidden="true" size={22} />
          </span>
          <span>เพิ่มเติม</span>
        </summary>
        <div className="tenant-mobile-more-menu">
          <strong>เมนูเพิ่มเติม</strong>
          {mobileMoreTabs.map(({ id, icon: Icon, label }) => (
            <Link aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "active" : ""} href={tenantPagePath(id)} key={id}>
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
              {notificationCount(id) > 0 ? <span className="notification-badge ml-auto">{notificationCount(id) > 99 ? "99+" : notificationCount(id)}</span> : null}
            </Link>
          ))}
        </div>
      </details>
    </nav>
    {active && activeTab !== "chat" && !isQuickChatOpen ? (
      <button
        aria-label={(notificationResource.data?.unreadMessages ?? 0) > 0
          ? `เปิดแชทกับหอพัก มีข้อความใหม่ ${notificationResource.data?.unreadMessages ?? 0} ข้อความ`
          : "เปิดแชทกับหอพัก"}
        className="chat-launcher tenant-chat-launcher"
        onClick={() => setIsQuickChatOpen(true)}
        type="button"
      >
        <MessageSquare aria-hidden="true" size={25} />
        {(notificationResource.data?.unreadMessages ?? 0) > 0 ? (
          <span className="chat-notification-badge">{Math.min(notificationResource.data?.unreadMessages ?? 0, 99)}</span>
        ) : null}
      </button>
    ) : null}
    {active && activeTab !== "chat" && isQuickChatOpen && !roomResource.isLoading && roomResource.data ? (
      <TenantChat
        onClose={() => setIsQuickChatOpen(false)}
        propertyId={roomResource.data.room.property.id}
        readOnly={isReadOnly}
        variant="widget"
      />
    ) : null}
  </main>
  </PageHeaderSlotProvider></TenantPortalContext.Provider>;
}

// เนื้อของแท็บหนึ่งแท็บ page ของแต่ละ route เรียกตัวนี้พร้อมบอกว่าเป็นแท็บอะไร
// ข้อมูลร่วมหยิบจาก context ที่เปลือกเตรียมไว้ จึงไม่ต้องโหลดซ้ำตอนเปลี่ยนแท็บ
export function TenantSectionPanel({
  initialInvoices = null,
  initialSummary = null,
  initialTickets = null,
  tab,
}: Readonly<{
  initialInvoices?: TenantInitialViews<Invoice> | null;
  initialSummary?: TenantHomeSummary | null;
  initialTickets?: TenantInitialViews<Ticket> | null;
  tab: TenantTab;
}>) {
  // เรียก context ครั้งเดียวบนสุด hook ห้ามอยู่หลัง early return
  const { account, active, isPrimary, isReadOnly, notificationResource, roomResource, setAccount, refreshAccount } = useTenantPortal();
  // หน้าบัญชีเปิดได้เสมอ แม้ยังไม่มีการเข้าพักที่อนุมัติ เพราะเป็นข้อมูลของตัวผู้ใช้เอง
  if (tab === "account") return <AccountPanel account={account} onUpdated={setAccount} refreshAccount={refreshAccount} />;
  // ยังไม่มีห้องที่ใช้งานอยู่ ทุกแท็บที่เหลือจึงไม่มีข้อมูลให้แสดง
  if (!active) return <PendingState account={account} />;
  if (tab === "home") {
    return <HomePanel
      account={account}
      initialSummary={initialSummary}
      isPrimary={isPrimary}
      notificationResource={notificationResource}
      roomResource={roomResource}
    />;
  }
  // บิลกับสัญญาเป็นเรื่องของผู้เช่าหลัก ผู้พักร่วมเห็นข้อความอธิบายแทน
  if (tab === "invoices") {
    return <PrimaryOnly isPrimary={isPrimary} message="เฉพาะผู้เช่าหลักเท่านั้นที่ดูและชำระบิลได้">
      <InvoicesPanel initialViews={initialInvoices} readOnly={isReadOnly} />
    </PrimaryOnly>;
  }
  if (tab === "lease") {
    return <PrimaryOnly isPrimary={isPrimary} message="เฉพาะผู้เช่าหลักเท่านั้นที่ดูสัญญาได้"><LeasePanel /></PrimaryOnly>;
  }
  if (tab === "announcements") return <AnnouncementsPanel />;
  if (tab === "parcels") return <ParcelsPanel />;
  if (tab === "tickets") return <TicketsPanel initialViews={initialTickets} onUnreadChanged={notificationResource.reload} readOnly={isReadOnly} />;
  if (tab === "chat") return <TenantChatSection isReadOnly={isReadOnly} roomResource={roomResource} />;
  return null;
}

// บางแท็บเปิดได้เฉพาะผู้เช่าหลัก ผู้พักร่วมเห็นข้อความอธิบายแทนที่จะเห็นหน้าว่าง
function PrimaryOnly({ children, isPrimary, message }: Readonly<{ children: ReactNode; isPrimary: boolean; message: string }>) {
  if (!isPrimary) return <RestrictedPanel message={message} />;
  return <>{children}</>;
}

// แชทต้องรู้รหัสหอก่อนถึงเปิดห้องได้ จึงรอข้อมูลห้องให้มาก่อน
function TenantChatSection({ isReadOnly, roomResource }: Readonly<{
  isReadOnly: boolean;
  roomResource: ReturnType<typeof useTenantPortal>["roomResource"];
}>) {
  if (roomResource.isLoading) return <Loading />;
  if (roomResource.error || !roomResource.data) {
    return <ErrorState error={roomResource.error} retry={() => void roomResource.reload()} />;
  }
  return <TenantChat propertyId={roomResource.data.room.property.id} readOnly={isReadOnly} />;
}

// แท็บบัญชีของฉัน แก้ข้อมูลติดต่อและเปลี่ยนรหัสผ่าน
function AccountPanel({
  account,
  onUpdated,
  refreshAccount,
}: Readonly<{
  account: Account;
  onUpdated: (account: Account) => void;
  refreshAccount: () => Promise<void>;
}>) {
  const [profile, setProfile] = useState({
    displayName: account.user.displayName,
    phone: account.phone,
    address: account.address ?? "",
    emergencyName: account.emergencyName ?? "",
    emergencyPhone: account.emergencyPhone ?? "",
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const notify = useToast();
  const isProfileDirty = profile.displayName !== account.user.displayName
    || profile.phone !== account.phone
    || profile.address !== (account.address ?? "")
    || profile.emergencyName !== (account.emergencyName ?? "")
    || profile.emergencyPhone !== (account.emergencyPhone ?? "");
  const isPasswordDirty = Object.values(password).some(Boolean);
  useUnsavedChanges((isProfileDirty || isPasswordDirty) && !isSavingProfile && !isSavingPassword);

  const saveProfile = async (event: SyntheticEvent) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const updated = await apiData<Account>(await fetch("/api/v1/tenant/me", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      }));
      onUpdated(updated);
      setProfileMessage("บันทึกข้อมูลบัญชีแล้ว");
      setIsEditingProfile(false);
      notify({ message: "บันทึกข้อมูลบัญชีแล้ว" });
    } catch (error) {
      const message = formatClientError(error, "บันทึกข้อมูลไม่สำเร็จ");
      setProfileError(message);
      notify({ message, tone: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async (event: SyntheticEvent) => {
    event.preventDefault();
    setPasswordError("");
    if (password.newPassword !== password.confirmPassword) {
      setPasswordError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setIsSavingPassword(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        }),
      });
      const payload = await readApiPayload<{ error?: string; redirectTo?: string; requestId?: string }>(response, "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      window.location.assign(payload.redirectTo ?? "/login");
    } catch (error) {
      const message = formatClientError(error, "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      setPasswordError(message);
      notify({ message, tone: "error" });
      setIsSavingPassword(false);
    }
  };

  const occupancyLabels = {
    PENDING: "รออนุมัติ",
    ACTIVE: "กำลังเข้าพัก",
    ENDED: "สิ้นสุดแล้ว",
    REJECTED: "ไม่อนุมัติ",
  } as const;

  return <div className="tenant-account-page">
    <div className="account-content">
      <section className="account-content-section">
        <h2>ข้อมูลบัญชี</h2>
        <div className="account-detail-row"><strong>ชื่อ-นามสกุล</strong><span>{account.user.displayName}</span><button onClick={() => { setProfileError(""); setProfileMessage(""); setIsEditingProfile(true); }} type="button">แก้ไข</button></div>
        <div className="account-detail-row"><strong>อีเมล</strong><span>{account.user.email}</span><small>จัดการโดยผู้ดูแลหอพัก</small></div>
        <div className="account-detail-row"><strong>เบอร์โทรศัพท์</strong><span>{account.phone || "ยังไม่ระบุ"}</span><small>ใช้สำหรับการติดต่อ</small></div>
        <div className="account-detail-row"><strong>ที่อยู่</strong><span>{account.address || "ยังไม่ระบุ"}</span><small>ข้อมูลส่วนตัว</small></div>
        <div className="account-detail-row"><strong>ผู้ติดต่อฉุกเฉิน</strong><span>{account.emergencyName || "ยังไม่ระบุ"}</span><small>{account.emergencyPhone || "ยังไม่ระบุเบอร์"}</small></div>
        {profileMessage ? <output className="account-settings-message success block">{profileMessage}</output> : null}
        {profileError ? <p className="account-settings-message error" role="alert">{profileError}</p> : null}
      </section>

      <section className="account-content-section">
        <h2>รหัสผ่านและความปลอดภัย</h2>
        <div className="account-detail-row"><strong>รหัสผ่าน</strong><span>••••••••••••</span><button onClick={() => { setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" }); setPasswordError(""); setIsEditingPassword(true); }} type="button">แก้ไข</button></div>
      </section>

      <section className="account-content-section">
        <h2>สถานะบัญชี</h2>
        <div className="account-standing-row"><span><CheckCircle2 size={22} /></span><div><strong>บัญชีของคุณพร้อมใช้งาน</strong><p>บัญชีผู้เช่าเปิดใช้งานตามปกติและเข้าถึงข้อมูลตามสิทธิ์ของคุณ</p></div><ChevronRight aria-hidden="true" size={20} /></div>
      </section>

      <section className="account-content-section">
        <h2>การเข้าพักของฉัน</h2>
        <div className="account-occupancy-list">
        {account.occupancies.length ? account.occupancies.map((occupancy) => <article className="account-occupancy-row" key={occupancy.id}>
          <div>
            <strong>{occupancy.property.name} · ห้อง {occupancy.room.number}</strong>
            <p className="text-sm text-[#62646c]">
              {occupancy.role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}
              {occupancy.startedAt ? ` · เริ่ม ${new Date(occupancy.startedAt).toLocaleDateString("th-TH")}` : ""}
              {occupancy.endedAt ? ` · สิ้นสุด ${new Date(occupancy.endedAt).toLocaleDateString("th-TH")}` : ""}
            </p>
          </div>
          <span className="badge">{occupancyLabels[occupancy.status]}</span>
        </article>) : <Empty description="เมื่อเจ้าของหอเพิ่มคุณเข้าห้องแล้ว ข้อมูลห้องและบริการจะแสดงที่นี่" icon={<Home />} text="ยังไม่มีข้อมูลการเข้าพัก" />}
        </div>
        <div className="mt-5 border-t border-[#e4e4e7] pt-5">
        <AcceptInvitationForm onAccepted={refreshAccount} />
        </div>
      </section>
      <PrivacyPreferencesPanel />
    </div>

    {isEditingProfile ? <Dialog ariaDescribedBy="tenant-profile-description" ariaLabelledBy="tenant-profile-title" className="modal-md" onClose={() => { if (!isSavingProfile) setIsEditingProfile(false); }}>
      <form className="modal-form" onSubmit={saveProfile}>
        <header className="modal-header"><div><h2 id="tenant-profile-title">แก้ไขข้อมูลส่วนตัว</h2><p id="tenant-profile-description">ข้อมูลสำหรับการติดต่อและกรณีฉุกเฉิน</p></div><IconButton disabled={isSavingProfile} label="ปิด" onClick={() => setIsEditingProfile(false)} tooltip="ปิดหน้าต่าง"><X /></IconButton></header>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span>ชื่อ-นามสกุล</span><input autoComplete="name" maxLength={120} minLength={2} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} required value={profile.displayName} /></label>
          <label><span>เบอร์โทรศัพท์</span><input autoComplete="tel" maxLength={30} minLength={8} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} required type="tel" value={profile.phone} /></label>
          <label className="sm:col-span-2"><span>ที่อยู่ (ไม่บังคับ)</span><textarea maxLength={1000} onChange={(event) => setProfile({ ...profile, address: event.target.value })} value={profile.address} /></label>
          <label><span>ผู้ติดต่อฉุกเฉิน</span><input maxLength={160} onChange={(event) => setProfile({ ...profile, emergencyName: event.target.value })} value={profile.emergencyName} /></label>
          <label><span>เบอร์ฉุกเฉิน</span><input maxLength={30} onChange={(event) => setProfile({ ...profile, emergencyPhone: event.target.value })} type="tel" value={profile.emergencyPhone} /></label>
        </div>
        {profileError ? <p className="account-settings-message error" role="alert">{profileError}</p> : null}
        <footer className="modal-actions"><button disabled={isSavingProfile} onClick={() => setIsEditingProfile(false)} type="button">ยกเลิก</button><button disabled={isSavingProfile} type="submit">{isSavingProfile ? "กำลังบันทึก..." : "บันทึก"}</button></footer>
      </form>
    </Dialog> : null}

    {isEditingPassword ? <Dialog ariaDescribedBy="tenant-password-description" ariaLabelledBy="tenant-password-title" className="modal-md" onClose={() => { if (!isSavingPassword) setIsEditingPassword(false); }}>
      <form className="modal-form" onSubmit={changePassword}>
        <header className="modal-header"><div><h2 id="tenant-password-title">เปลี่ยนรหัสผ่าน</h2><p id="tenant-password-description">หลังเปลี่ยนแล้วระบบจะออกจากทุกอุปกรณ์</p></div><IconButton disabled={isSavingPassword} label="ปิด" onClick={() => setIsEditingPassword(false)} tooltip="ปิดหน้าต่าง"><X /></IconButton></header>
        <div className="account-password-fields">
          <label><span>รหัสผ่านปัจจุบัน</span><input autoComplete="current-password" maxLength={256} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} required type="password" value={password.currentPassword} /></label>
          <label><span>รหัสผ่านใหม่</span><input autoComplete="new-password" maxLength={128} minLength={12} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} required type="password" value={password.newPassword} /></label>
          <label><span>ยืนยันรหัสผ่านใหม่</span><input autoComplete="new-password" maxLength={128} minLength={12} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} required type="password" value={password.confirmPassword} /></label>
        </div>
        <p className="account-password-hint"><LockKeyhole size={17} /> อย่างน้อย 12 ตัวอักษร พร้อมตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข</p>
        {passwordError ? <p className="account-settings-message error" role="alert">{passwordError}</p> : null}
        <footer className="modal-actions"><button disabled={isSavingPassword} onClick={() => setIsEditingPassword(false)} type="button">ยกเลิก</button><button disabled={isSavingPassword} type="submit">{isSavingPassword ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}</button></footer>
      </form>
    </Dialog> : null}
  </div>;
}

// รับคำเชิญเข้าห้องเพิ่ม ใช้ตอนผู้เช่าเดิมได้รหัสเชิญของอีกห้องมา
function AcceptInvitationForm({ onAccepted }: Readonly<{ onAccepted: () => Promise<void> }>) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    setIsSending(true); setError(""); setMessage("");
    try {
      const result = await apiData<{ message: string }>(await fetch("/api/v1/tenant/invitations/accept", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationCode: code }),
      }));
      setCode("");
      setMessage(result.message);
      await onAccepted();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "รับคำเชิญไม่สำเร็จ");
    } finally {
      setIsSending(false);
    }
  };
  return <form className="grid gap-2" onSubmit={submit}>
    <label className="text-xs font-bold" htmlFor="tenant-invitation-code">มีรหัสเชิญอีกห้อง?</label>
    <input
      className="min-w-0 rounded-xl border border-[#d8d9df] px-3 py-2 text-sm"
      id="tenant-invitation-code"
      onChange={(event) => setCode(event.target.value)}
      placeholder="วางรหัสเชิญ"
      required
      value={code}
    />
    <button className="primary-button justify-center" disabled={isSending} type="submit">
      {isSending ? <LoaderCircle className="animate-spin" size={16} /> : null} รับคำเชิญ
    </button>
    {message ? <output className="text-emerald-700">{message}</output> : null}
    {error ? <small className="text-red-600" role="alert">{error}</small> : null}
  </form>;
}

// หน้าจอตอนสมัครแล้วแต่ยังไม่ได้รับอนุมัติ ยังเข้าใช้งานส่วนอื่นไม่ได้
function PendingState({ account }: Readonly<{ account: Account }>) {
  const latest = account.occupancies[0];
  return <Panel title="สถานะการเข้าพัก"><div className="empty-state"><Clock3 size={40} /><strong>{latest?.status === "PENDING" ? "รอเจ้าของหออนุมัติ" : "ยังไม่มีการเข้าพักที่ใช้งาน"}</strong><p>เมื่อได้รับอนุมัติแล้ว คุณจะเข้าถึงข้อมูลห้องและบริการของหอได้</p></div></Panel>;
}

// แท็บหน้าหลัก ดึงเฉพาะ 5 รายการล่าสุดของแต่ละอย่างมาแสดงพอให้เห็นภาพรวม
// initialSummary มาจาก Server Component ของหน้าแรก สามรายการนี้จึงมาพร้อม HTML
// ส่วนห้องกับยอดแจ้งเตือนยังมาจาก context เพราะเปลือกโหลดไว้แล้วและใช้ร่วมกับแถบเมนู
// หน้าบิลกับหน้าแจ้งเรื่องมีสองมุมมอง ส่งมาได้ทั้งคู่หรือจะส่งแค่มุมมองที่เปิดอยู่ก็ได้
export type TenantInitialViews<T> = { current?: InitialPage<T> | null; history?: InitialPage<T> | null };

export type TenantHomeSummary = {
  invoices: Invoice[] | null;
  parcels: Parcel[] | null;
  tickets: Ticket[] | null;
};

function HomePanel({
  account,
  initialSummary,
  isPrimary,
  notificationResource,
  roomResource,
}: Readonly<{
  account: Account;
  initialSummary?: TenantHomeSummary | null;
  isPrimary: boolean;
  notificationResource: ReturnType<typeof useApiResource<TenantNotificationSummary>>;
  roomResource: ReturnType<typeof useApiResource<RoomData>>;
}>) {
  const invoices = useApiResource<Invoice[]>("/api/v1/tenant/invoices?page=1&pageSize=5", isPrimary, initialSummary?.invoices ?? null);
  const parcels = useApiResource<Parcel[]>("/api/v1/tenant/parcels?page=1&pageSize=5", true, initialSummary?.parcels ?? null);
  const tickets = useApiResource<Ticket[]>("/api/v1/tenant/tickets?page=1&pageSize=5", true, initialSummary?.tickets ?? null);
  if (roomResource.isLoading) return <Loading />;
  if (roomResource.error || !roomResource.data) {
    return <ErrorState error={roomResource.error} retry={() => void roomResource.reload()} />;
  }

  const { room, startedAt } = roomResource.data;
  const furniture = Array.isArray(room.furniture) ? room.furniture.filter((item): item is string => typeof item === "string") : [];
  const unpaidInvoice = invoices.data?.find((invoice) => ["PENDING", "OVERDUE"].includes(invoice.status));
  const waitingParcel = parcels.data?.find((parcel) => parcel.status === "WAITING");
  const openTicket = tickets.data?.find((ticket) => !["RESOLVED", "CANCELLED"].includes(ticket.status));
  const summary = notificationResource.data;
  const hasOverviewError = notificationResource.error || invoices.error || parcels.error || tickets.error;

  return <div className="tenant-home">
    <div className="tenant-home-surface">

    {hasOverviewError ? (
      <div className="form-alert error flex flex-wrap items-center justify-between gap-3" role="alert">
        <span>ข้อมูลสรุปบางส่วนโหลดไม่สำเร็จ กรุณาลองใหม่</span>
        <RetryButton onClick={() => {
          void Promise.all([
            notificationResource.reload(),
            ...(isPrimary ? [invoices.reload()] : []),
            parcels.reload(),
            tickets.reload(),
          ]);
        }} />
      </div>
    ) : null}

    <AppSection description="บิล พัสดุ และเรื่องที่กำลังติดตาม" icon={<Gauge />} title="ภาพรวมที่ต้องรู้">
      <div className="figma-summary-grid three">
        <HomePriorityCard
          tone="orange"
          detail={unpaidInvoiceDetail(isPrimary, unpaidInvoice)}
          href={tenantPagePath("invoices")}
          icon={<ReceiptText />}
          label="ยอดที่ต้องชำระ"
          value={unpaidInvoiceValue(isPrimary, unpaidInvoice)}
        />
        <HomePriorityCard
          tone="blue"
          detail={waitingParcel
            ? `${waitingParcel.note || "พัสดุใหม่"} · ${new Date(waitingParcel.registeredAt).toLocaleDateString("th-TH")}`
            : "ไม่มีพัสดุรอรับ"}
          href={tenantPagePath("parcels")}
          icon={<Package />}
          label="พัสดุรอรับ"
          value={`${summary?.waitingParcels ?? 0} รายการ`}
        />
        <HomePriorityCard
          tone="indigo"
          detail={openTicket ? openTicket.title : "ไม่มีเรื่องที่กำลังดำเนินการ"}
          href={tenantPagePath("tickets")}
          icon={<Wrench />}
          label="เรื่องที่กำลังติดตาม"
          value={`${summary?.openTickets ?? 0} รายการ`}
        />
      </div>
    </AppSection>

    <AppSection description="รายการที่ต้องเข้าไปจัดการในตอนนี้" icon={<ListChecks />} title="งานที่ต้องทำ">
      <HomeTaskList
        isLoading={notificationResource.isLoading}
        isPrimary={isPrimary}
        openTicket={openTicket}
        summary={summary}
        unpaidInvoice={unpaidInvoice}
      />
    </AppSection>

    <AppSection description="รายละเอียดห้องที่กำลังเข้าพัก" icon={<Home />} title="ข้อมูลห้อง">
    <div className="grid gap-4 sm:grid-cols-3">
      <InfoCard label="ค่าเช่าต่อเดือน" value={currency.format(Number(room.monthlyRent))} />
      <InfoCard label="ประเภทห้อง" value={room.roomType} />
      <InfoCard label="เริ่มเข้าพัก" value={startedAt ? new Date(startedAt).toLocaleDateString("th-TH") : "-"} />
    </div>

    <details className="rounded-xl border border-[#e4e4e7] bg-[#fff] p-4 group">
      <summary className="cursor-pointer list-none text-sm font-semibold">ข้อมูลห้องและช่องทางติดต่อ</summary>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Info label="ที่อยู่" value={room.property.settings?.address ?? "-"} />
        <Info label="โทรศัพท์" value={room.property.settings?.contactPhone ?? "-"} />
        <Info label="อีเมล" value={room.property.settings?.contactEmail ?? "-"} />
        <Info label="ติดต่อฉุกเฉิน" value={room.property.settings?.emergencyContact ?? "-"} />
        <Info label="อุปกรณ์ในห้อง" value={furniture.join(", ") || "-"} />
        <Info label="เบอร์ผู้เช่า" value={account.phone} />
      </dl>
      {room.property.settings?.houseRules ? <div className="mt-5 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-4"><strong>กฎของหอพัก</strong><p className="mt-2 whitespace-pre-wrap">{room.property.settings.houseRules}</p></div> : null}
    </details>
    </AppSection>
    </div>
  </div>;
}

// ผู้พักร่วมไม่มีบิลของตัวเอง ส่วนผู้เช่าหลักดูว่ามีบิลค้างอยู่ไหม
function unpaidInvoiceDetail(isPrimary: boolean, invoice: Invoice | undefined) {
  if (!isPrimary) return "ผู้พักร่วมไม่ต้องดำเนินการ";
  if (!invoice) return "ไม่มีบิลที่ต้องชำระ";
  return `ครบกำหนด ${new Date(invoice.dueDate).toLocaleDateString("th-TH")}`;
}

function unpaidInvoiceValue(isPrimary: boolean, invoice: Invoice | undefined) {
  if (!isPrimary) return "-";
  return invoice ? currency.format(Number(invoice.total)) : "ไม่มี";
}

// รายการงานที่ต้องเข้าไปจัดการ ไม่มีอะไรค้างเลยก็แสดงสถานะว่างแทน
function HomeTaskList({ isLoading, isPrimary, openTicket, summary, unpaidInvoice }: Readonly<{
  isLoading: boolean;
  isPrimary: boolean;
  openTicket: Ticket | undefined;
  summary: TenantNotificationSummary | null;
  unpaidInvoice: Invoice | undefined;
}>) {
  const waitingParcels = summary?.waitingParcels ?? 0;
  const openTickets = summary?.openTickets ?? 0;
  const unreadMessages = summary?.unreadMessages ?? 0;
  const showInvoiceTask = isPrimary && Boolean(unpaidInvoice);
  const nothingToDo = !showInvoiceTask && waitingParcels === 0 && openTickets === 0 && unreadMessages === 0 && !isLoading;

  return <div className="work-item-grid">
    {showInvoiceTask && unpaidInvoice ? <HomeTask
      detail={`บิล ${unpaidInvoice.invoiceNumber} ครบกำหนด ${new Date(unpaidInvoice.dueDate).toLocaleDateString("th-TH")}`}
      href={tenantPagePath("invoices")}
      icon={<ReceiptText size={20} />}
      label={unpaidInvoice.status === "OVERDUE" ? "บิลเกินกำหนดชำระ" : "ชำระบิลรอบล่าสุด"}
    /> : null}
    {waitingParcels > 0 ? <HomeTask detail={`มีพัสดุรอรับ ${waitingParcels} รายการ`} href={tenantPagePath("parcels")} icon={<Package size={20} />} label="รับพัสดุที่หอพัก" /> : null}
    {openTickets > 0 ? <HomeTask detail={openTicket ? `รายการล่าสุด: ${openTicket.title}` : `${openTickets} รายการกำลังดำเนินการ`} href={tenantPagePath("tickets")} icon={<Wrench size={20} />} label="ติดตามเรื่องที่แจ้งไว้" /> : null}
    {unreadMessages > 0 ? <HomeTask detail={`มีข้อความที่ยังไม่ได้อ่าน ${unreadMessages} ข้อความ`} href={tenantPagePath("chat")} icon={<MessageSquare size={20} />} label="อ่านข้อความจากหอพัก" /> : null}
    {nothingToDo ? <div className="empty-state min-h-36">
      <Clock3 size={32} />
      <strong>ไม่มีรายการที่ต้องดำเนินการ</strong>
      <p>เมื่อมีบิล พัสดุ หรือการอัปเดต ระบบจะแสดงที่นี่</p>
    </div> : null}
    {isLoading ? <Loading /> : null}
  </div>;
}

// ใช้การ์ดตัวเลขใบเดียวกับฝั่งเจ้าของหอและผู้ดูแลระบบ ต่างกันแค่กดแล้วไปหน้าอื่นได้
// เดิมเป็นการ์ดพื้นสีพาสเทลเต็มใบ ซึ่งเป็นคนละภาษากับอีกสองโรล
function HomePriorityCard({ detail, href, icon, label, tone, value }: Readonly<{
  detail: string;
  href: string;
  icon: ReactNode;
  label: string;
  tone: string;
  value: string;
}>) {
  // span ต้องเป็นลูกโดยตรงของการ์ด ถึงจะได้กรอบไอคอนแบบเดียวกับอีกสองโรล
  return <Link className={`figma-summary-card tone-${tone} pr-12 hover:border-[#c8c9d0]`} href={href}>
    <div className="min-w-0"><small>{label}</small><strong>{value}</strong><small className="mt-1.5 block">{detail}</small></div>
    <span>{icon}</span>
    <ArrowRight aria-hidden="true" className="absolute right-4 bottom-4 text-[#62646c]" size={18} />
  </Link>;
}

// รายการงานหนึ่งบรรทัด ใช้โครงและคลาสเดียวกับหน้าแรกของเจ้าของหอและผู้ดูแลระบบ
function HomeTask({ detail, href, icon, label }: Readonly<{
  detail: string;
  href: string;
  icon: ReactNode;
  label: string;
}>) {
  return <Link href={href}>
    <span className="work-item-icon">{icon}</span>
    <span className="work-item-copy">
      <strong className="block">{label}</strong>
      <small className="block truncate text-[#62646c]">{detail}</small>
    </span>
    <ChevronRight aria-hidden="true" className="work-item-arrow" size={20} />
  </Link>;
}

type Invoice = { id: string; invoiceNumber: string; billingMonth: string; status: string; dueDate: string; total: string; paidAt: string | null; cancelledAt: string | null };
type InvoiceDetail = Invoice & { subtotal: string; lateFee: string; room: { number: string }; items: Array<{ id: string; description: string; quantity: string; unitPrice: string; amount: string }> };
type Submission = { id: string; amount: string; status: string; submittedAt: string; reviewedAt: string | null; rejectionNote: string | null };

function TenantHistoryTabs({
  currentLabel,
  historyLabel,
  id,
  onChange,
  view,
}: Readonly<{
  currentLabel: string;
  historyLabel: string;
  id: string;
  onChange: (view: TenantRecordView) => void;
  view: TenantRecordView;
}>) {
  const handleKeyDown = useTablistKeyboard(["current", "history"] as const, onChange);
  const tabs = [
    { label: currentLabel, value: "current" as const },
    { label: historyLabel, value: "history" as const },
  ];
  return <div aria-label="เลือกประเภทข้อมูล" className="figma-inline-tabs invoice-tabs" onKeyDown={handleKeyDown} role="tablist">
    {tabs.map((tab) => <button aria-controls={`${id}-panel`} aria-selected={view === tab.value} className={view === tab.value ? "active" : ""} id={`${id}-tab-${tab.value}`} key={tab.value} onClick={() => onChange(tab.value)} role="tab" tabIndex={view === tab.value ? 0 : -1} type="button">
      {tab.label}
    </button>)}
  </div>;
}

function TenantHistoryTable({ children, title, total }: Readonly<{ children: ReactNode; title: string; total: number | null }>) {
  return <section className="figma-table-card">
    <header className="additional-card-head">
      <div><h2>{title}</h2><p>{total === null ? "กำลังนับรายการ..." : `ทั้งหมด ${total.toLocaleString("th-TH")} รายการ`}</p></div>
    </header>
    <div className="figma-table-wrap">{children}</div>
  </section>;
}

function InvoicesPanel({ initialViews, readOnly }: Readonly<{ initialViews?: TenantInitialViews<Invoice> | null; readOnly: boolean }>) {
  const [view, setView] = useState<TenantRecordView>("current");
  const currentResource = usePaginatedResource<Invoice>("/api/v1/tenant/invoices?view=current", 20, initialViews?.current ?? null);
  const historyResource = usePaginatedResource<Invoice>("/api/v1/tenant/invoices?view=history", 20, initialViews?.history ?? null, view === "history");
  const reloadCurrentInvoices = currentResource.reload;
  const reloadInvoiceHistory = historyResource.reload;
  const resource = view === "current" ? currentResource : historyResource;
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const changeView = (nextView: TenantRecordView) => {
    setExpandedInvoiceId(null);
    setView(nextView);
  };

  // บิลใบเดียวอาจถูกแก้จากทั้งสองมุมมอง โหลดใหม่ทั้งคู่จะได้ไม่ค้างของเก่า
  const reloadInvoices = useCallback(async () => {
    await Promise.all([reloadCurrentInvoices(), reloadInvoiceHistory()]);
  }, [reloadCurrentInvoices, reloadInvoiceHistory]);

  const toggleExpanded = (invoiceId: string) => {
    setExpandedInvoiceId((current) => current === invoiceId ? null : invoiceId);
  };

  return <div className="grid gap-5">
    <TenantHistoryTabs currentLabel="บิลปัจจุบัน" historyLabel="ประวัติบิล" id="tenant-invoices" onChange={changeView} view={view} />
    <div aria-labelledby={`tenant-invoices-tab-${view}`} aria-live="polite" id="tenant-invoices-panel" role="tabpanel" tabIndex={0}>
      <InvoicesBody
        expandedInvoiceId={expandedInvoiceId}
        historyTotal={historyResource.total}
        onChanged={reloadInvoices}
        onToggle={toggleExpanded}
        readOnly={readOnly}
        resource={resource}
        view={view}
      />
      {!resource.isLoading && !resource.error ? <PaginationActions resource={resource} /> : null}
    </div>
  </div>;
}

type InvoiceListProps = Readonly<{
  expandedInvoiceId: string | null;
  historyTotal: number | null;
  onChanged: () => Promise<void>;
  onToggle: (invoiceId: string) => void;
  readOnly: boolean;
  resource: PaginatedResource<Invoice>;
  view: TenantRecordView;
}>;

// เลือกว่าจะแสดงอะไรในแผงบิล กำลังโหลด พัง ว่าง ประวัติ หรือรายการปัจจุบัน
function InvoicesBody(props: InvoiceListProps) {
  const { resource, view } = props;
  if (resource.isLoading && !resource.data.length) return <Loading columns={6} variant={view === "history" ? "table" : "list"} />;
  if (resource.error && !resource.data.length) return <ErrorState error={resource.error} retry={() => void resource.reload()} />;
  if (resource.data.length === 0) {
    return view === "current"
      ? <Empty description="เมื่อถึงรอบบิลถัดไป รายการจะมาแสดงที่นี่" icon={<ReceiptText />} text="ไม่มีบิลที่ต้องดำเนินการ" />
      : <Empty description="บิลที่ชำระเสร็จแล้วจะย้ายมาเก็บไว้ที่นี่" icon={<ReceiptText />} text="ยังไม่มีประวัติบิล" />;
  }
  if (view === "history") return <InvoiceHistoryTable {...props} />;
  return <InvoiceCards {...props} />;
}

// มุมมองประวัติเป็นตาราง กดแถวแล้วกางรายละเอียดออกมาเป็นแถวถัดไป
function InvoiceHistoryTable({ expandedInvoiceId, historyTotal, onChanged, onToggle, readOnly, resource }: InvoiceListProps) {
  return <TenantHistoryTable title="ประวัติบิล" total={historyTotal}>
    <table>
      <thead><tr><th scope="col">เลขที่บิล</th><th scope="col">รอบบิล</th><th scope="col">ยอดรวม</th><th scope="col">สถานะ</th><th scope="col">วันที่ดำเนินการ</th><th aria-label="จัดการ" scope="col" /></tr></thead>
      <tbody>{resource.data.map((invoice) => {
        const isExpanded = expandedInvoiceId === invoice.id;
        const panelId = `tenant-invoice-details-${invoice.id}`;
        const completedAt = invoice.paidAt ?? invoice.cancelledAt;
        return <Fragment key={invoice.id}>
          <tr>
            <th className="px-6 py-4 text-sm font-bold" scope="row">{invoice.invoiceNumber}</th>
            <td>{new Date(invoice.billingMonth).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</td>
            <td><strong>{currency.format(Number(invoice.total))}</strong></td>
            <td><Status value={invoice.status} /></td>
            <td>{completedAt ? new Date(completedAt).toLocaleDateString("th-TH") : "—"}</td>
            <td><button aria-controls={panelId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียดบิล ${invoice.invoiceNumber}`} className="grid size-10 place-items-center rounded-xl bg-[#f1f1f3] text-[#555761]" onClick={() => onToggle(invoice.id)} type="button"><ChevronDown aria-hidden="true" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={20} /></button></td>
          </tr>
          {isExpanded ? <tr><td className="p-0!" colSpan={6}><InvoiceDetails id={panelId} invoice={invoice} onChanged={onChanged} readOnly={readOnly} /></td></tr> : null}
        </Fragment>;
      })}</tbody>
    </table>
  </TenantHistoryTable>;
}

// มุมมองปัจจุบันเป็นการ์ด กดแล้วกางรายละเอียดอยู่ในการ์ดเดิม
function InvoiceCards({ expandedInvoiceId, onChanged, onToggle, readOnly, resource }: InvoiceListProps) {
  return <div className="grid gap-3">
    {resource.data.map((invoice) => {
      const isExpanded = expandedInvoiceId === invoice.id;
      const panelId = `tenant-invoice-details-${invoice.id}`;
      return <article className={`panel overflow-hidden p-0 transition ${isExpanded ? "border-brand" : ""}`} key={invoice.id}>
        <button aria-controls={panelId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียดบิล ${invoice.invoiceNumber} ยอด ${currency.format(Number(invoice.total))} สถานะ ${formatStatus(invoice.status)}`} className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-brand/[.03]" onClick={() => onToggle(invoice.id)} type="button">
          <span><strong className="block text-lg">{invoice.invoiceNumber}</strong><small>{new Date(invoice.billingMonth).toLocaleDateString("th-TH", { month: "long", year: "numeric" })} · ครบกำหนด {new Date(invoice.dueDate).toLocaleDateString("th-TH")}</small></span>
          <span className="flex shrink-0 items-center gap-4 text-right">
            <span><strong className="block text-xl">{currency.format(Number(invoice.total))}</strong><Status value={invoice.status} /></span>
            <span className="grid size-10 place-items-center rounded-xl bg-[#f1f1f3] text-[#555761]" title={isExpanded ? "ยุบรายละเอียด" : "ขยายรายละเอียด"}><ChevronDown aria-hidden="true" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={20} /></span>
          </span>
        </button>
        {isExpanded ? <InvoiceDetails id={panelId} invoice={invoice} onChanged={onChanged} readOnly={readOnly} /> : null}
      </article>;
    })}
  </div>;
}

function InvoiceDetails({ id, invoice, onChanged, readOnly }: Readonly<{ id: string; invoice: Invoice; onChanged: () => Promise<void>; readOnly: boolean }>) {
  const detail = useApiResource<InvoiceDetail>(`/api/v1/tenant/invoices/${invoice.id}`);
  const submissions = useApiResource<Submission[]>(`/api/v1/tenant/invoices/${invoice.id}/payment-submissions`);
  // ชำระได้เฉพาะบิลที่ยังค้างอยู่ บิลที่จ่ายแล้วหรือยกเลิกแล้วเปิดดูได้อย่างเดียว
  const payable = ["PENDING", "OVERDUE"].includes(invoice.status);

  return <section aria-label={`รายละเอียดบิล ${invoice.invoiceNumber}`} className="border-t border-[#e4e4e7] bg-[#fcfcfe] p-5" id={id}>
    <InvoiceLineItems detail={detail} />
    <InvoicePaymentBox
      invoice={invoice}
      onSubmitted={async () => { await Promise.all([submissions.reload(), onChanged()]); }}
      payable={payable}
      readOnly={readOnly}
    />
    <SubmissionHistory submissions={submissions.data} />
  </section>;
}

// รายการค่าใช้จ่ายในบิล กำลังโหลด โหลดได้ หรือโหลดไม่สำเร็จ
function InvoiceLineItems({ detail }: Readonly<{ detail: ReturnType<typeof useApiResource<InvoiceDetail>> }>) {
  if (detail.isLoading) return <Loading />;
  if (!detail.data) return <ErrorState error={detail.error} retry={() => void detail.reload()} />;
  return <div className="grid gap-2">
    {detail.data.items.map((item) => <div className="flex justify-between gap-3 rounded-xl bg-[#f3f3f5] p-3" key={item.id}>
      <span>{item.description} × {item.quantity}</span>
      <strong>{currency.format(Number(item.amount))}</strong>
    </div>)}
    <div className="flex justify-between p-3 text-lg"><span>ค่าปรับ</span><strong>{currency.format(Number(detail.data.lateFee))}</strong></div>
  </div>;
}

// กล่องชำระเงิน มี QR พร้อมเพย์และช่องอัปโหลดสลิป
function InvoicePaymentBox({ invoice, onSubmitted, payable, readOnly }: Readonly<{
  invoice: Invoice;
  onSubmitted: () => Promise<void>;
  payable: boolean;
  readOnly: boolean;
}>) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (!payable) return null;
  if (readOnly) return <ReadOnlyNotice className="mt-5">ตรวจสอบรายละเอียดและประวัติหลักฐานได้ แต่ไม่สามารถชำระหรือส่งสลิปใหม่ได้</ReadOnlyNotice>;

  const submit = async () => {
    if (!file) return;
    setIsSending(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/v1/tenant/invoices/${invoice.id}/payment-submissions`, { method: "POST", credentials: "same-origin", body });
      await apiData(response);
      setFile(null);
      await onSubmitted();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "ส่งสลิปไม่สำเร็จ");
    } finally {
      setIsSending(false);
    }
  };

  // ยังไม่ได้เลือกไฟล์ก็กดส่งไม่ได้ และต้องบอกเหตุผลไว้ให้เห็นด้วย
  const missingFile = !file && !isSending;

  return <div className="mt-5 grid gap-4 rounded-xl border border-brand/20 p-4">
    <PromptPayQr invoice={invoice} />
    <label><span>อัปโหลดสลิป PNG, JPG หรือ PDF ไม่เกิน 5 MB</span><input accept="image/png,image/jpeg,application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" /></label>
    {error ? <p className="form-alert error" role="alert">{error}</p> : null}
    <button aria-describedby={missingFile ? "payment-slip-disabled-reason" : undefined} className="primary-button" disabled={!file || isSending} onClick={() => void submit()} type="button">
      <Upload size={17} />{isSending ? "กำลังส่ง..." : "ส่งหลักฐาน"}
    </button>
    {missingFile ? <p className="disabled-reason" id="payment-slip-disabled-reason">เลือกไฟล์สลิปก่อนส่งหลักฐานการชำระเงิน</p> : null}
  </div>;
}

// ประวัติสลิปที่เคยส่งไป พร้อมเหตุผลเมื่อถูกปฏิเสธ
function SubmissionHistory({ submissions }: Readonly<{ submissions: Submission[] | null }>) {
  return <div className="mt-5">
    <strong>ประวัติหลักฐาน</strong>
    {submissions?.map((item) => <div className="mt-2 flex justify-between rounded-xl bg-[#f3f3f5] p-3" key={item.id}>
      <span>{new Date(item.submittedAt).toLocaleString("th-TH")}</span>
      <span><Status value={item.status} />{item.rejectionNote ? <small className="block">{item.rejectionNote}</small> : null}</span>
    </div>)}
    {submissions?.length === 0 ? <p className="mt-2 text-[#62646c]">ยังไม่เคยส่งหลักฐาน</p> : null}
  </div>;
}

function PromptPayQr({ invoice }: Readonly<{ invoice: Invoice }>) {
  const promptPay = useApiResource<{ invoiceNumber: string; amount: string; payload: string }>(`/api/v1/tenant/invoices/${invoice.id}/promptpay-qr?format=json`);
  if (promptPay.isLoading) return <Loading />;
  if (promptPay.error || !promptPay.data) return <div className="form-alert error">{promptPay.error || "ไม่สามารถสร้าง PromptPay QR ได้"}</div>;
  return <div className="text-center">
    <strong className="block text-lg">สแกน PromptPay</strong>
    <Image alt={`PromptPay QR ${invoice.invoiceNumber}`} className="mx-auto mt-3 rounded-xl" height={240} src={`/api/v1/tenant/invoices/${invoice.id}/promptpay-qr`} unoptimized width={240} />
    <p className="mt-2 text-sm text-[#62646c]">ยอด {currency.format(Number(promptPay.data.amount))}</p>
  </div>;
}

type Lease = { id: string; leaseNumber: string; status: string; startDate: string; endDate: string; monthlyRent: string; depositAmount: string; currentVersion: number; activatedAt: string | null; room: { number: string } };
function LeasePanel() {
  const resource = useApiResource<{ current: Lease | null; upcoming: Lease | null }>("/api/v1/tenant/lease");
  if (resource.isLoading) return <Loading />;
  if (resource.error) return <ErrorState error={resource.error} retry={() => void resource.reload()} />;
  if (!resource.data?.current && !resource.data?.upcoming) return <Empty description="เมื่อเจ้าของหอออกสัญญาให้แล้ว เอกสารจะมาแสดงที่นี่" icon={<FileText />} text="ยังไม่มีสัญญาที่พร้อมแสดง" />;
  return <div className="grid gap-5">
    {resource.data.current ? <TenantLeaseCard lease={resource.data.current} title="สัญญาปัจจุบัน" /> : <Empty icon={<FileText />} description="สัญญาที่สิ้นสุดแล้วยังเปิดดูได้จากประวัติด้านล่าง" text="ไม่มีสัญญาที่กำลังใช้งานในขณะนี้" />}
    {resource.data.upcoming ? <TenantLeaseCard lease={resource.data.upcoming} title="สัญญารอบถัดไป" /> : null}
  </div>;
}

function TenantLeaseCard({ lease, title }: Readonly<{ lease: Lease; title: string }>) {
  return <section aria-labelledby={`tenant-lease-${lease.id}`} className="grid gap-2">
    <h2 className="text-base font-semibold text-[#292a30]" id={`tenant-lease-${lease.id}`}>{title}</h2>
    <Panel title={lease.leaseNumber}>
    <div className="grid gap-4 sm:grid-cols-2"><Info label="สถานะ" value={formatStatus(lease.status)} /><Info label="Version" value={`v${lease.currentVersion}`} /><Info label="วันเริ่มต้น" value={new Date(lease.startDate).toLocaleDateString("th-TH")} /><Info label="วันสิ้นสุด" value={new Date(lease.endDate).toLocaleDateString("th-TH")} /><Info label="ค่าเช่า" value={currency.format(Number(lease.monthlyRent))} /><Info label="เงินประกัน" value={currency.format(Number(lease.depositAmount))} /></div>
    <a className="primary-button mt-5 inline-flex" href={`/api/v1/tenant/lease/signed-document?leaseId=${encodeURIComponent(lease.id)}`} rel="noreferrer" target="_blank"><FileText size={17} /> เปิดเอกสารลงนาม</a>
    </Panel>
  </section>;
}

type Announcement = { id: string; title: string; content: string; publishedAt: string | null; publishAt: string | null; createdAt: string };
function AnnouncementsPanel() {
  const resource = usePaginatedResource<Announcement>("/api/v1/tenant/announcements");
  return <ResourceList resource={resource} title="ประกาศจากหอพัก" subtitle="ข่าวสารที่ส่งถึงอาคาร ชั้น หรือห้องของคุณ" empty="ยังไม่มีประกาศ" emptyDescription="ประกาศจากหอพักจะมาแสดงที่นี่">{(item) => <Panel key={item.id} title={item.title}><p className="whitespace-pre-wrap">{item.content}</p><time className="mt-3 block text-sm text-[#62646c]">{new Date(item.publishedAt ?? item.publishAt ?? item.createdAt).toLocaleString("th-TH")}</time></Panel>}</ResourceList>;
}

type Parcel = { id: string; status: string; note: string | null; registeredAt: string; receivedAt: string | null; imageUrl: string | null };
function ParcelsPanel() {
  const [view, setView] = useState<TenantRecordView>("current");
  const currentResource = usePaginatedResource<Parcel>("/api/v1/tenant/parcels?view=current");
  const historyResource = usePaginatedResource<Parcel>("/api/v1/tenant/parcels?view=history");
  const resource = view === "current" ? currentResource : historyResource;
  return <div className="grid gap-5">
    <TenantHistoryTabs currentLabel="พัสดุรอรับ" historyLabel="ประวัติการรับ" id="tenant-parcels" onChange={setView} view={view} />
    <div aria-labelledby={`tenant-parcels-tab-${view}`} id="tenant-parcels-panel" role="tabpanel" tabIndex={0}>
      {view === "history" && !resource.isLoading && !resource.error && resource.data.length ? <div className="grid gap-5"><TenantHistoryTable title="ประวัติการรับพัสดุ" total={historyResource.total}>
        <table>
          <thead><tr><th scope="col">พัสดุ</th><th scope="col">หมายเหตุ</th><th scope="col">วันที่รับเข้าระบบ</th><th scope="col">วันที่รับพัสดุ</th><th scope="col">สถานะ</th></tr></thead>
          <tbody>{resource.data.map((item) => <tr key={item.id}>
            <td>{item.imageUrl ? <Image alt="รูปพัสดุ" className="size-14 rounded-xl object-cover" height={56} src={item.imageUrl} unoptimized width={56} /> : <span className="text-[#62646c]">ไม่มีรูป</span>}</td>
            <td>{item.note || "ไม่มีหมายเหตุ"}</td>
            <td>{new Date(item.registeredAt).toLocaleString("th-TH")}</td>
            <td>{item.receivedAt ? new Date(item.receivedAt).toLocaleString("th-TH") : "—"}</td>
            <td><Status value={item.status} /></td>
          </tr>)}</tbody>
        </table>
      </TenantHistoryTable><PaginationActions resource={resource} /></div> : <ResourceList loadingColumns={5} loadingVariant={view === "history" ? "table" : "list"} resource={resource} title="พัสดุของห้อง" subtitle="ตรวจสอบพัสดุที่หอรับไว้ให้" empty={view === "current" ? "ไม่มีพัสดุรอรับ" : "ยังไม่มีประวัติการรับพัสดุ"}>{(item) => <Panel key={item.id} title={item.status === "WAITING" ? "รอรับพัสดุ" : "รับแล้ว"}><div className="flex gap-4">{item.imageUrl ? <Image alt="รูปพัสดุ" className="size-24 rounded-xl object-cover" height={96} src={item.imageUrl} unoptimized width={96} /> : null}<div><p>{item.note || "ไม่มีหมายเหตุ"}</p><time className="text-sm text-[#62646c]">รับเข้าระบบ {new Date(item.registeredAt).toLocaleString("th-TH")}</time>{item.receivedAt ? <time className="mt-1 block text-sm text-[#62646c]">รับพัสดุแล้ว {new Date(item.receivedAt).toLocaleString("th-TH")}</time> : null}</div></div></Panel>}</ResourceList>}
    </div>
  </div>;
}

type Ticket = {
  id: string; type: "REPAIR" | "COMPLAINT"; status: string; priority: string;
  title: string; detail: string; createdAt: string; updatedAt: string;
  hasUnreadReply: boolean;
  attachments: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>;
  events: Array<{
    id: string; type: "CREATED" | "STATUS_CHANGED" | "PRIORITY_CHANGED" | "ATTACHMENT_ADDED" | "REPLY_ADDED";
    fromValue: string | null; toValue: string | null; createdAt: string;
  }>;
};
function TicketsPanel({ initialViews, onUnreadChanged, readOnly }: Readonly<{ initialViews?: TenantInitialViews<Ticket> | null; onUnreadChanged: () => Promise<void>; readOnly: boolean }>) {
  const [view, setView] = useState<TenantRecordView>("current");
  const currentResource = usePaginatedResource<Ticket>("/api/v1/tenant/tickets?view=current", 20, initialViews?.current ?? null);
  const historyResource = usePaginatedResource<Ticket>("/api/v1/tenant/tickets?view=history", 20, initialViews?.history ?? null, view === "history");
  const resource = view === "current" ? currentResource : historyResource;
  const reloadCurrentTickets = currentResource.reload;
  const reloadTicketHistory = historyResource.reload;
  const [isOpen, setIsOpen] = useState(false);
  const [openReplyTicketId, setOpenReplyTicketId] = useState<string | null>(null);

  // เรื่องเดียวกันอาจย้ายมุมมองหลังเปลี่ยนสถานะ โหลดใหม่ทั้งคู่จะได้ไม่ค้างของเก่า
  const reloadTickets = useCallback(async () => {
    await Promise.all([reloadCurrentTickets(), reloadTicketHistory()]);
  }, [reloadCurrentTickets, reloadTicketHistory]);

  const changeView = (nextView: TenantRecordView) => {
    setOpenReplyTicketId(null);
    setView(nextView);
  };

  const markRead = () => {
    void resource.reload();
    void onUnreadChanged();
  };

  const toggleReply = (ticketId: string) => {
    setOpenReplyTicketId((current) => current === ticketId ? null : ticketId);
  };

  return <div className="grid gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TenantHistoryTabs currentLabel="กำลังดำเนินการ" historyLabel="ประวัติเรื่อง" id="tenant-tickets" onChange={changeView} view={view} />
      {!readOnly ? <PageHeaderActions><button className="primary-button" onClick={() => setIsOpen(true)} type="button"><Wrench size={17} /> แจ้งเรื่อง</button></PageHeaderActions> : null}
    </div>
    {readOnly ? <ReadOnlyNotice>ดูสถานะ ประวัติ และไฟล์แนบเดิมได้ แต่ไม่สามารถสร้างหรือตอบกลับรายการได้</ReadOnlyNotice> : null}
    <div aria-labelledby={`tenant-tickets-tab-${view}`} id="tenant-tickets-panel" role="tabpanel" tabIndex={0}>
      <TicketsBody
        historyTotal={historyResource.total}
        onRead={markRead}
        onToggleReply={toggleReply}
        openReplyTicketId={openReplyTicketId}
        readOnly={readOnly}
        resource={resource}
        view={view}
      />
      {resource.error && resource.data.length ? <p className="form-alert error" role="alert">{resource.error}</p> : null}
      <PaginationActions resource={resource} />
    </div>
    {isOpen && !readOnly ? <TicketDialog onClose={() => setIsOpen(false)} onCreated={reloadTickets} /> : null}
  </div>;
}

type TicketListProps = Readonly<{
  historyTotal: number | null;
  onRead: () => void;
  onToggleReply: (ticketId: string) => void;
  openReplyTicketId: string | null;
  readOnly: boolean;
  resource: PaginatedResource<Ticket>;
  view: TenantRecordView;
}>;

// เลือกว่าจะแสดงอะไรในแผงเรื่องแจ้ง กำลังโหลด พัง ว่าง ประวัติ หรือรายการปัจจุบัน
function TicketsBody(props: TicketListProps) {
  const { resource, view } = props;
  if (resource.isLoading && !resource.data.length) return <Loading columns={5} variant={view === "history" ? "table" : "list"} />;
  if (resource.error && !resource.data.length) return <ErrorState error={resource.error} retry={() => void resource.reload()} />;
  if (resource.data.length === 0) {
    return <Empty icon={<Wrench />} text={view === "current" ? "ไม่มีเรื่องที่กำลังดำเนินการ" : "ยังไม่มีประวัติเรื่อง"} />;
  }
  if (view === "history") return <TicketHistoryTable {...props} />;
  return <TicketCards {...props} />;
}

// มุมมองประวัติเป็นตาราง กดแถวแล้วกางรายละเอียดออกมาเป็นแถวถัดไป
function TicketHistoryTable({ historyTotal, onRead, onToggleReply, openReplyTicketId, readOnly, resource }: TicketListProps) {
  return <TenantHistoryTable title="ประวัติเรื่องแจ้ง" total={historyTotal}>
    <table>
      <thead><tr><th scope="col">หัวข้อ</th><th scope="col">ประเภท</th><th scope="col">วันที่แจ้ง</th><th scope="col">สถานะ</th><th aria-label="จัดการ" scope="col" /></tr></thead>
      <tbody>{resource.data.map((ticket) => {
        const isExpanded = openReplyTicketId === ticket.id;
        const detailsId = `tenant-ticket-history-${ticket.id}`;
        return <Fragment key={ticket.id}>
          <tr>
            <th className="px-6 py-4 text-sm font-bold" scope="row">{ticket.title}</th>
            <td>{ticketTypeLabel(ticket.type)}</td>
            <td>{new Date(ticket.createdAt).toLocaleString("th-TH")}</td>
            <td><Status value={ticket.status} /></td>
            <td><button aria-controls={detailsId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียด ${ticket.title}`} className="grid size-10 place-items-center rounded-xl bg-[#f1f1f3] text-[#555761]" onClick={() => onToggleReply(ticket.id)} type="button"><ChevronDown aria-hidden="true" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={20} /></button></td>
          </tr>
          {isExpanded ? <tr><td className="p-0!" colSpan={5}><div className="p-5" id={detailsId}>
            <TicketDetailsContent onRead={onRead} readOnly={readOnly} showReplyThread ticket={ticket} />
          </div></td></tr> : null}
        </Fragment>;
      })}</tbody>
    </table>
  </TenantHistoryTable>;
}

// มุมมองปัจจุบันเป็นการ์ด เปิดการตอบกลับได้ทีละเรื่อง
function TicketCards({ onRead, onToggleReply, openReplyTicketId, readOnly, resource }: TicketListProps) {
  return <>
    {resource.data.map((ticket) => <Panel key={ticket.id} title={ticket.title}>
      <TicketDetailsContent
        onRead={onRead}
        readOnly={readOnly}
        showReplyThread={openReplyTicketId === ticket.id}
        ticket={ticket}
        toggleReply={() => onToggleReply(ticket.id)}
      />
    </Panel>)}
  </>;
}

// เรื่องแจ้งมีสองประเภท แจ้งซ่อมกับร้องเรียน
function ticketTypeLabel(type: Ticket["type"]) {
  return type === "REPAIR" ? "แจ้งซ่อม" : "ร้องเรียน";
}

// คำบรรยายของเหตุการณ์หนึ่งบรรทัดในไทม์ไลน์ของเรื่องแจ้ง
function ticketEventLabel(event: Ticket["events"][number]) {
  if (event.type === "CREATED") return "สร้างรายการ";
  if (event.type === "STATUS_CHANGED") return `เปลี่ยนสถานะ ${formatStatus(event.fromValue)} → ${formatStatus(event.toValue)}`;
  if (event.type === "PRIORITY_CHANGED") return `เปลี่ยนความสำคัญ ${formatStatus(event.fromValue)} → ${formatStatus(event.toValue)}`;
  if (event.type === "REPLY_ADDED") return "มีข้อความตอบกลับ";
  return "แนบไฟล์";
}

function TicketDetailsContent({ onRead, readOnly, showReplyThread, ticket, toggleReply }: Readonly<{
  onRead: () => void;
  readOnly: boolean;
  showReplyThread: boolean;
  ticket: Ticket;
  toggleReply?: () => void;
}>) {
  return <>
    <div className="flex flex-wrap gap-2"><Status value={ticket.status} /><span className="badge">{ticketTypeLabel(ticket.type)}</span><span className="badge">{formatStatus(ticket.priority)}</span>{ticket.hasUnreadReply ? <span className="badge bg-red-600 text-white">มีข้อความใหม่</span> : null}</div>
    <p className="mt-3 whitespace-pre-wrap">{ticket.detail}</p>
    {ticket.attachments.map((file) => <a className="mt-3 flex items-center gap-2 text-brand underline" href={`/api/v1/tenant/tickets/${ticket.id}/attachments/${file.id}`} key={file.id} rel="noreferrer" target="_blank"><Paperclip size={15} />{file.fileName}</a>)}
    <ol className="mt-4 grid gap-2 border-t pt-4">{ticket.events.map((event) => <li className="text-sm text-[#62646c]" key={event.id}><time>{new Date(event.createdAt).toLocaleString("th-TH")}</time> · {ticketEventLabel(event)}</li>)}</ol>
    {toggleReply ? <button className="secondary-button mt-4" onClick={toggleReply} type="button"><MessageSquare size={16} /> {showReplyThread ? "ปิดการตอบกลับ" : "เปิดการตอบกลับ"}</button> : null}
    {showReplyThread ? <TicketReplyThread endpoint={`/api/v1/tenant/tickets/${ticket.id}/replies`} onRead={onRead} readOnly={readOnly} viewerRole="TENANT" /> : null}
  </>;
}

function TicketDialog({ onClose, onCreated }: Readonly<{ onClose: () => void; onCreated: () => Promise<void> }>) {
  const [form, setForm] = useState({ type: "REPAIR", title: "", detail: "", priority: "NORMAL", isAnonymous: false });
  const [file, setFile] = useState<File | null>(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const submit = async (event: SyntheticEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      let ticketId = createdTicketId;
      if (!ticketId) {
        const response = await fetch("/api/v1/tenant/tickets", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, isAnonymous: form.type === "COMPLAINT" && form.isAnonymous }) });
        const ticket = await apiData<{ id: string }>(response);
        ticketId = ticket.id;
        setCreatedTicketId(ticket.id);
      }
      if (file) { const body = new FormData(); body.set("file", file); await apiData(await fetch(`/api/v1/tenant/tickets/${ticketId}/attachments`, { method: "POST", credentials: "same-origin", body })); }
      await onCreated(); onClose();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "สร้างรายการไม่สำเร็จ"); }
    finally { setSaving(false); }
  };
  return <Dialog ariaDescribedBy="tenant-ticket-description" ariaLabelledBy="tenant-ticket-title" className="modal-md" onClose={onClose}><header className="modal-header"><div><h2 id="tenant-ticket-title">แจ้งเรื่องใหม่</h2><p id="tenant-ticket-description">ส่งรายการแจ้งซ่อมหรือร้องเรียนถึงผู้ดูแลหอพัก</p></div><IconButton label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างแจ้งเรื่อง"><X /></IconButton></header><form className="modal-form" onSubmit={submit}>
    <div className="modal-grid"><DropdownField label="ประเภท" onChange={(value) => setForm({ ...form, type: value })} options={[{ label: "แจ้งซ่อม", value: "REPAIR" }, { label: "ร้องเรียน", value: "COMPLAINT" }]} value={form.type} /><DropdownField label="ความเร่งด่วน" onChange={(value) => setForm({ ...form, priority: value })} options={[{ label: "ปกติ", value: "NORMAL" }, { label: "ด่วน", value: "URGENT" }]} value={form.priority} /></div>
    <label><span>หัวข้อ</span><input maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label><label><span>รายละเอียด</span><textarea maxLength={4000} onChange={(event) => setForm({ ...form, detail: event.target.value })} required value={form.detail} /></label>
    {form.type === "COMPLAINT" ? <label className="flex items-center gap-2"><input checked={form.isAnonymous} className="size-5 min-h-0" onChange={(event) => setForm({ ...form, isAnonymous: event.target.checked })} type="checkbox" /> ไม่แสดงชื่อกับผู้ดูแลหอ</label> : null}
    <label><span>แนบไฟล์ (ไม่บังคับ)</span><input accept="image/png,image/jpeg,application/pdf,.pdf" onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && next.size > 5 * 1024 * 1024) { setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB"); event.target.value = ""; setFile(null); return; } setError(""); setFile(next); }} type="file" /></label>{error ? <p className="form-alert error">{error}</p> : null}<footer className="modal-actions"><button onClick={onClose} type="button">ปิด</button><button className="primary-button" disabled={saving} type="submit">{ticketSubmitLabel(createdTicketId, saving)}</button></footer>
  </form></Dialog>;
}

type ChatMessage = { id: string; body: string; senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN"; senderName: string; createdAt: string; attachment: { name: string; mimeType: string; size: number; url: string } | null };
function TenantChat({
  onClose,
  propertyId,
  readOnly,
  variant = "page",
}: Readonly<{
  onClose?: () => void;
  propertyId: string;
  readOnly: boolean;
  variant?: "page" | "widget";
}>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const {
    attachment, endRef, error, fileInputRef, hasOlderMessages, isLoading, isLoadingOlder,
    isSending, loadOlderMessages, message, messages, scrollRef, sendMessage,
    setAttachment, setError, setMessage,
  } = useChatThread<ChatMessage>({
    endpoint: "/api/v1/tenant/chat",
    propertyId,
    requireConversationId: true,
    streaming: true,
  });

  const messageList = <TenantChatMessages
    endRef={endRef}
    hasOlderMessages={hasOlderMessages}
    isLoading={isLoading}
    isLoadingOlder={isLoadingOlder}
    messages={messages}
    onLoadOlder={() => void loadOlderMessages()}
    scrollRef={scrollRef}
    variant={variant}
  />;

  const composer = <TenantChatComposer
    attachment={attachment}
    fileInputRef={fileInputRef}
    isSending={isSending}
    message={message}
    onSubmit={sendMessage}
    readOnly={readOnly}
    setAttachment={setAttachment}
    setError={setError}
    setMessage={setMessage}
    variant={variant}
  />;

  if (variant === "widget") {
    return <aside aria-label="แชทกับหอพัก" aria-modal="false" className={`chat-widget tenant-chat-widget${isExpanded ? " expanded" : ""}`} role="dialog">
      <header className="chat-widget-header">
        <div className="chat-conversation-brand">
          <span className="chat-person-avatar support"><MessageSquare aria-hidden="true" size={19} /></span>
          <span>
            <strong className="block">ติดต่อหอ</strong>
            <small className="block text-[#62646c]">ข้อความถึงผู้ดูแลหอพัก</small>
          </span>
        </div>
        <div className="chat-header-actions">
          <WindowOptionsMenu
            isExpanded={isExpanded}
            isMenuOpen={isOptionsOpen}
            onToggleExpanded={() => { setIsExpanded((current) => !current); setIsOptionsOpen(false); }}
            onToggleMenu={() => setIsOptionsOpen((current) => !current)}
          />
          <button aria-label="ปิดช่องแชท" onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
        </div>
      </header>
      {error ? <p className="chat-error mx-3 mt-3" role="alert">{error}</p> : null}
      {messageList}
      {composer}
    </aside>;
  }

  return <div className="grid gap-5">
    <Panel title="ข้อความ">
      {error ? <p className="form-alert error" role="alert">{error}</p> : null}
      {messageList}
      {composer}
    </Panel>
  </div>;
}

// ไฟล์แนบในข้อความ รูปแสดงเป็นภาพตัวอย่าง ไฟล์อื่นแสดงเป็นลิงก์พร้อมขนาด
function TenantChatAttachment({ attachment }: Readonly<{ attachment: ChatMessage["attachment"] }>) {
  if (!attachment) return null;
  if (attachment.mimeType.startsWith("image/")) {
    return <a className="chat-image-attachment" href={attachment.url} rel="noreferrer" target="_blank">
      <Image alt={attachment.name} height={240} src={attachment.url} unoptimized width={320} />
    </a>;
  }
  return <a className="chat-file-attachment" href={attachment.url} rel="noreferrer" target="_blank">
    <FileText aria-hidden="true" size={22} />
    <span><strong>{attachment.name}</strong><small>{(attachment.size / 1024).toFixed(1)} KB</small></span>
  </a>;
}

// รายการข้อความ หน้าเต็มกับหน้าต่างมุมจอใช้คลาสคนละชุด
function TenantChatMessages({ endRef, hasOlderMessages, isLoading, isLoadingOlder, messages, onLoadOlder, scrollRef, variant }: Readonly<{
  endRef: React.RefObject<HTMLDivElement | null>;
  hasOlderMessages: boolean;
  isLoading: boolean;
  isLoadingOlder: boolean;
  messages: ChatMessage[];
  onLoadOlder: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  variant: "page" | "widget";
}>) {
  const className = variant === "widget"
    ? "tenant-quick-chat-messages"
    : "tenant-chat-message-list my-4 h-[420px] overflow-y-auto rounded-xl bg-[#f3f3f5] p-4";
  return <div className={className} ref={scrollRef}>
    {isLoading ? <Loading /> : null}
    {!isLoading && messages.length === 0 ? <p className="m-auto text-center text-sm text-[#62646c]">ยังไม่มีข้อความ เริ่มพูดคุยกับหอพักได้เลย</p> : null}
    {!isLoading && hasOlderMessages ? <LoadMoreButton className="mb-3 border-t-0 p-0" isLoading={isLoadingOlder} label="โหลดข้อความก่อนหน้า" onClick={onLoadOlder} /> : null}
    {messages.map((item) => <article className={`chat-message ${item.senderRole === "TENANT" ? "from-tenant" : "from-admin"}`} key={item.id}>
      <strong>{item.senderName}</strong>
      {item.body ? <p>{item.body}</p> : null}
      <TenantChatAttachment attachment={item.attachment} />
      <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("th-TH")}</time>
    </article>)}
    <div ref={endRef} />
  </div>;
}

// ช่องพิมพ์ข้อความของผู้เช่า โหมดอ่านอย่างเดียวแสดงป้ายแทนฟอร์ม
function TenantChatComposer({ attachment, fileInputRef, isSending, message, onSubmit, readOnly, setAttachment, setError, setMessage, variant }: Readonly<{
  attachment: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isSending: boolean;
  message: string;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  readOnly: boolean;
  setAttachment: (file: File | null) => void;
  setError: (value: string) => void;
  setMessage: (value: string) => void;
  variant: "page" | "widget";
}>) {
  if (readOnly) {
    return <div className={variant === "widget" ? "p-3" : undefined}>
      <ReadOnlyNotice>อ่านประวัติข้อความได้ แต่ไม่สามารถส่งข้อความใหม่ได้</ReadOnlyNotice>
    </div>;
  }

  const clearAttachment = () => {
    setAttachment(null);
    // ล้างค่า input ด้วย ไม่งั้นเลือกไฟล์ชื่อเดิมซ้ำจะไม่เกิด onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ตรวจขนาดตั้งแต่ตอนเลือก จะได้ไม่เสียเวลาอัปโหลดแล้วโดนปฏิเสธ ส่วนเซิร์ฟเวอร์ตรวจซ้ำอยู่ดี
  const pickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
      event.target.value = "";
      return;
    }
    setError("");
    setAttachment(file);
  };

  const nothingToSend = !message.trim() && !attachment;

  return <form className={variant === "widget" ? "chat-composer" : "tenant-chat-composer"} onSubmit={onSubmit}>
    {attachment ? <div className="chat-attachment-preview">
      <FileText aria-hidden="true" size={18} />
      <span>{attachment.name}</span>
      <IconButton label="นำไฟล์แนบออก" onClick={clearAttachment} size="sm"><X aria-hidden="true" size={16} /></IconButton>
    </div> : null}
    <div className="flex gap-2">
      <input accept="image/png,image/jpeg,image/webp,application/pdf" className="chat-file-input" onChange={pickFile} ref={fileInputRef} type="file" />
      <IconButton className="chat-attach-button" disabled={isSending} label="แนบรูปหรือไฟล์" onClick={() => fileInputRef.current?.click()}>
        <Paperclip aria-hidden="true" size={18} />
      </IconButton>
      <input
        aria-label="ข้อความถึงหอพัก"
        className="min-w-0 flex-1 rounded-xl border border-[#d7d8df] px-4"
        maxLength={4000}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="พิมพ์ข้อความ..."
        value={message}
      />
      <button aria-label={isSending ? "กำลังส่งข้อความ" : "ส่งข้อความ"} className={variant === "widget" ? undefined : "primary-button"} disabled={isSending || nothingToSend} type="submit">
        {isSending ? <LoaderCircle className="animate-spin" size={17} /> : <Send aria-hidden="true" size={17} />}
        {variant === "page" ? <span>{isSending ? "กำลังส่ง..." : "ส่ง"}</span> : null}
      </button>
    </div>
    {variant === "page" && nothingToSend && !isSending ? <p className="disabled-reason mt-2">พิมพ์ข้อความหรือแนบไฟล์ก่อนกดส่ง</p> : null}
  </form>;
}

function ResourceList<T extends { id: string }>({ children, empty, emptyDescription, loadingColumns, loadingVariant, resource }: Readonly<{ children: (item: T) => ReactNode; empty: string; emptyDescription?: string; loadingColumns?: number; loadingVariant?: "list" | "table"; resource: PaginatedResource<T>; subtitle: string; title: string }>) {
  if (resource.isLoading) return <Loading columns={loadingColumns} variant={loadingVariant} />;
  if (resource.error && !resource.data.length) return <ErrorState error={resource.error} retry={() => void resource.reload()} />;
  return <div className="grid gap-5"><LiveAnnouncement message={listAnnouncement({ hasNextPage: resource.hasNextPage, isLoading: resource.isLoadingMore, total: resource.data.length })} />{resource.data.length ? resource.data.map(children) : <Empty description={emptyDescription} icon={<Bell />} text={empty} />}{resource.error ? <p className="form-alert error" role="alert">{resource.error}</p> : null}<PaginationActions resource={resource} /></div>;
}
function PaginationActions<T>({ resource }: Readonly<{ resource: PaginatedResource<T> }>) {
  if (!resource.hasNextPage) return null;
  return <button className="secondary-button mx-auto" disabled={resource.isLoadingMore} onClick={() => void resource.loadMore()} type="button">
    {resource.isLoadingMore ? <><LoaderCircle className="animate-spin" size={17} /> กำลังโหลด...</> : "โหลดรายการเพิ่มเติม"}
  </button>;
}
// มุมมองประวัติแสดงเป็นตาราง ส่วนรายการปัจจุบันเป็นการ์ด โครงหลอกจึงต้องเปลี่ยนตามมุมมองที่เปิดอยู่
function Loading({ columns, variant = "list" }: Readonly<{ columns?: number; variant?: "list" | "table" }>) {
  return <LoadingSkeleton columns={columns} count={3} label="กำลังโหลดข้อมูล" variant={variant} />;
}
function ErrorState({ error, retry }: Readonly<{ error: string; retry: () => void }>) { return <div className="form-alert error" role="alert"><span>{error || "โหลดข้อมูลไม่สำเร็จ"}</span><RetryButton onClick={retry} /></div>; }
function RestrictedPanel({ message }: Readonly<{ message: string }>) { return <Empty icon={<QrCode />} text={message} />; }

// เรื่องถูกสร้างไปแล้วแต่ไฟล์แนบพลาด กดอีกครั้งคือลองอัปโหลดไฟล์ ไม่ใช่สร้างเรื่องซ้ำ
function ticketSubmitLabel(createdTicketId: string | null, saving: boolean) {
  if (saving) return "กำลังส่ง...";
  return createdTicketId ? "ลองอัปโหลดไฟล์อีกครั้ง" : "ส่งเรื่อง";
}
