"use client";
// ถือ state ของทั้งพื้นที่ผู้เช่า และโหลดข้อมูลใหม่จากเบราว์เซอร์

import Image from "next/image";
import Link from "next/link";
import { AppSection } from "@/components/ui/AppSection";
import { IconButton } from "@/components/ui/IconButton";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { usePathname, useRouter } from "next/navigation";
import { SyntheticEvent, Fragment, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Download,
  ImagePlus,
  Bell,
  Clock3,
  Check,
  CheckCircle2,
  CircleHelp,
  ChevronDown,
  ChevronLeft,
  FileText,
  Home,
  LoaderCircle,
  MessageSquare,
  FileCheck2,
  LogOut,
  MoreHorizontal,
  Package,
  Plus,
  Paperclip,
  QrCode,
  ReceiptText,
  Upload,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { TicketReplyThread } from "@/components/dorm/TicketReplyThread";
import { DropdownField } from "@/components/dorm/DropdownField";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { RetryButton } from "@/components/ui/DataNavigation";
import { useChatThread } from "@/components/chat/use-chat-thread";
import { ChatComposer, ChatEmptyState, ChatMessageList, WindowSizeButton } from "@/components/chat/ChatParts";
import { TicketChatThread, TicketIcon, TicketInboxRow, ticketStatusTone, ticketTypeLabel } from "@/components/chat/TicketChatThread";
import { closedTicketNotice, ticketAcceptsReplies, type TicketInboxItem, type TicketInboxStatus } from "@/lib/ticket-inbox";
import { Dialog } from "@/components/ui/Dialog";
import { PlatformBrand } from "@/components/ui/PlatformBrand";
import { NotificationCenter, type NotificationCenterItem } from "@/components/ui/NotificationCenter";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { appSidebarId, NavShell, NavToggle } from "@/components/ui/NavShell";
import { useLogout } from "@/lib/client/use-logout";
import { useRefreshOnFocus } from "@/lib/client/use-refresh-on-focus";
import { SidebarAccountMenu } from "@/components/ui/SidebarAccountMenu";
import { useToast } from "@/components/ui/ToastProvider";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";
import { formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { currency } from "@/lib/dorm-utils";
import { describeInvoiceDue } from "@/lib/domain/invoice-due";
import { formatBankAccount, formatThaiDate, formatThaiDateTime, formatThaiMonth, formatThaiPhone } from "@/lib/thai-format";
import { CopyButton } from "@/components/ui/CopyButton";
import { formatInvoiceStatus, formatStatus, formatTicketStatus } from "@/lib/ui-labels";
import { AskDormButton } from "@/components/tenant/AskDormButton";
import { RoomSwitcher } from "@/components/tenant/RoomSwitcher";
import { TenantHelp } from "@/components/tenant/TenantHelp";
import { Empty, Info, InfoCard, Panel, Status } from "@/components/tenant/primitives";
import { tenantPagePath, tenantTabFromSegments, type TenantTab } from "@/lib/navigation-routes";
import { blocksSubscriptionMutations, resolveSubscriptionUiAccessState, type SubscriptionUiAccessState } from "@/lib/client/subscription-access-state";
import { tenantChatOpenEvent } from "@/lib/tenant-chat";
import { ticketProgress } from "@/lib/tenant-records";
import type { TenantRecordView } from "@/lib/tenant-record-view";
import { AccountCard, AccountFormCard, AccountProfileCard, AccountReadOnlyField } from "@/components/account/AccountLayout";
import { PrivacyPreferencesPanel } from "@/components/legal/PrivacyPreferencesPanel";
import { PageHeaderActions, PageHeaderSlotProvider, PageHeaderTarget } from "@/components/ui/PageHeaderSlot";
import { PasswordRequirements } from "@/components/ui/PasswordRequirements";
import { PHONE_INPUT_PATTERN } from "@/lib/domain/phone";

// บัญชีผู้เช่าหนึ่งคน คนหนึ่งอาจมีหลายการเข้าพัก เช่นย้ายห้องหรือเช่าหลายห้อง
type Account = {
  id: string;
  phone: string;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  user: { avatarUrl?: string | null; displayName: string; email: string };
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
  { id: "help", label: "ช่วยเหลือ", icon: CircleHelp },
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
  help: "คำถามที่พบบ่อยและวิธีใช้พื้นที่ผู้เช่า",
};

// แถบล่างบนมือถือใส่ได้แค่ 4 ช่อง จึงเลือกเฉพาะที่ใช้บ่อย ที่เหลือไปอยู่ในเมนูเพิ่มเติม
const mobilePrimaryTabs = tabs.filter(({ id }) => ["home", "invoices", "parcels", "tickets"].includes(id));
// แชทกับบัญชีไม่อยู่ในเมนูหลักของจอกว้าง เพราะมีปุ่มของตัวเองอยู่แล้ว
// ช่วยเหลืออยู่ในเมนูบัญชีท้ายแถบข้าง ไม่ต้องกินที่ในเมนูหลัก
const navigationTabs = tabs.filter(({ id }) => !["chat", "account", "help"].includes(id));
// หน้าที่ผู้พักร่วมเปิดไม่ได้ เพราะบิลและสัญญาเป็นเรื่องของผู้เช่าหลัก
const primaryOnlyTabs = new Set<TenantTab>(["invoices", "lease"]);
const mobileMoreTabs = tabs.filter(({ id }) => ["lease", "announcements", "account", "help"].includes(id));

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
// ตัวเลขบนป้ายของแต่ละแท็บ นับเฉพาะเรื่องที่ผู้เช่าต้องลงมือทำเอง ป้ายจะได้หายเมื่อทำเสร็จ
// บิลที่ส่งสลิปแล้วกับเรื่องแจ้งที่รอหออยู่ไม่ต้องนับ เพราะผู้เช่าไม่มีอะไรให้ทำต่อ
// หน้าหลักไม่มีป้าย ยอดรวมอยู่ที่กระดิ่งแล้ว ถ้ามีทั้งสองที่จะเห็นเลขเดียวกันซ้ำสองจุด
function tabNotificationCount(tab: TenantTab, summary: TenantNotificationSummary | null) {
  if (!summary) return 0;
  if (tab === "invoices") return summary.unpaidInvoices;
  if (tab === "parcels") return summary.waitingParcels;
  if (tab === "tickets") return summary.unreadTicketReplies;
  if (tab === "chat") return summary.unreadMessages;
  return 0;
}

// รายการในกระดิ่งแจ้งเตือนของผู้เช่า ไม่มีข้อมูลสรุปก็ยังไม่มีอะไรให้แจ้ง
function buildTenantNotifications(summary: TenantNotificationSummary | null): NotificationCenterItem[] {
  if (!summary) return [];
  return [
    { id: "unpaid-invoices", tone: "attention", count: summary.unpaidInvoices, title: "บิลที่รอชำระ", description: "ตรวจสอบยอดและกำหนดชำระของบิลล่าสุด", href: tenantPagePath("invoices"), icon: <ReceiptText size={19} /> },
    { id: "waiting-parcels", count: summary.waitingParcels, title: "มีพัสดุรอรับ", description: "ติดต่อหอพักเพื่อรับพัสดุของคุณ", href: tenantPagePath("parcels"), icon: <Package size={19} /> },
    { id: "open-tickets", count: summary.openTickets, title: "เรื่องแจ้งที่กำลังดำเนินการ", description: "ติดตามสถานะงานซ่อมหรือเรื่องร้องเรียน", href: tenantPagePath("tickets"), icon: <Wrench size={19} /> },
    { id: "ticket-replies", tone: "attention", count: summary.unreadTicketReplies, title: "มีคำตอบใหม่ในเรื่องแจ้ง", description: "เปิดอ่านคำตอบล่าสุดจากผู้ดูแลหอ", href: tenantPagePath("tickets"), icon: <MessageSquare size={19} /> },
    { id: "messages", tone: "attention", count: summary.unreadMessages, title: "ข้อความใหม่จากหอพัก", description: "เปิดอ่านข้อความจากผู้ดูแลหอ", href: tenantPagePath("chat"), icon: <MessageSquare size={19} /> },
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
    {icon}<span>{label}</span>
    {count > 0 ? <span aria-label={`${count} รายการที่ต้องตรวจสอบ`} className="notification-badge">{count > 99 ? "99+" : count}</span> : null}
  </Link>;
}

// แถบบอกสถานะสิทธิ์การใช้งานของหอ แสดงได้ทีละกรณีเท่านั้น
function TenantAccessBanner({ accessState, onRetry }: Readonly<{
  accessState: SubscriptionUiAccessState;
  onRetry: () => void;
}>) {
  if (accessState === "loading") {
    return <output className="subscription-access-banner grace is-checking mx-auto mt-5 max-w-[1400px]">
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
  // ปุ่ม "ถามหอในแชท" ในหน้าพัสดุหรือสัญญาเปิดห้องแชทกับหอตรง ๆ ไม่ต้องผ่านรายการก่อน
  // ตัวเลขเปลี่ยนทุกครั้งที่กด แชทเล็กจะได้เริ่มใหม่ที่ห้องแชทแม้เปิดค้างไว้ที่หน้าอื่น
  const [quickChatRequest, setQuickChatRequest] = useState<{ nonce: number; view: "list" | "chat" }>({ nonce: 0, view: "list" });
  useEffect(() => {
    const open = () => {
      setQuickChatRequest((current) => ({ nonce: current.nonce + 1, view: "chat" }));
      setIsQuickChatOpen(true);
    };
    window.addEventListener(tenantChatOpenEvent, open);
    return () => window.removeEventListener(tenantChatOpenEvent, open);
  }, []);
  // ต้องเช็คสถานะด้วย ไม่ใช่เทียบแค่ id เพราะห้องที่เลือกไว้อาจย้ายออกไปแล้ว
  const active = account.occupancies.find((item) => item.id === selectedOccupancyId && item.status === "ACTIVE");
  const activeRooms = account.occupancies.filter(({ status }) => status === "ACTIVE");
  const roomResource = useApiResource<RoomData>("/api/v1/tenant/room", Boolean(active));
  const notificationResource = useApiResource<TenantNotificationSummary>(
    "/api/v1/tenant/notifications/summary",
    Boolean(active),
  );
  // ข้อความหรือบิลใหม่จะได้ขึ้นป้ายเองระหว่างเปิดหน้าทิ้งไว้ ไม่ต้องรีเฟรช
  useRefreshOnFocus(notificationResource.reload);
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
  const refreshAccount = useCallback(async () => {
    const updated = await apiData<Account>(await fetch("/api/v1/tenant/me", {
      cache: "no-store",
      credentials: "same-origin",
    }));
    setAccount(updated);
  }, []);

  const activeTabItem = tabs.find(({ id }) => id === activeTab) ?? tabs[0];
  const { isLoggingOut, logout } = useLogout();

  // useMemo ให้ object ของ context เปลี่ยนเฉพาะตอนข้อมูลข้างในเปลี่ยน หน้าย่อยจะได้ไม่ render ซ้ำโดยไม่จำเป็น
  const portalValue = useMemo<TenantPortalValue>(() => ({
    account, accessState, active, isPrimary: primary, isReadOnly,
    notificationResource, roomResource, setAccount, refreshAccount,
  }), [account, accessState, active, primary, isReadOnly, notificationResource, roomResource, refreshAccount]);

  return <TenantPortalContext.Provider value={portalValue}><PageHeaderSlotProvider>
    <NavShell className="tenant-portal tenant-shell shell text-[#292a30]">
    <LiveAnnouncement message={`เปิดหน้า ${tabs.find(({ id }) => id === activeTab)?.label ?? "พื้นที่ผู้เช่า"}`} />
    <aside className="sidebar tenant-sidebar" id={appSidebarId}>
      <div className="sidebar-head">
        <div className="brand tenant-brand">
          <PlatformBrand className="[&_small]:text-[#62646c] [&_strong]:text-base" imageClassName="size-11" subtitle="พื้นที่ผู้เช่า" />
        </div>
        <NavToggle />
      </div>
      {active
        ? <div className="tenant-sidebar-room"><RoomSwitcher activeId={active.id} disabled={isSwitching} onSwitch={(id) => void switchOccupancy(id)} rooms={activeRooms} variant="sidebar" /></div>
        : <p className="tenant-sidebar-property">พื้นที่ผู้เช่า</p>}
      <nav aria-label="เมนูผู้เช่า">
        {/* ผู้พักร่วมไม่เห็นบิลและสัญญา ซ่อนเมนูไปเลย ดีกว่าให้กดเข้าไปเจอแค่ข้อความว่าไม่มีสิทธิ์ */}
        {navigationTabs.filter(({ id }) => primary || !primaryOnlyTabs.has(id)).map(({ id, icon: Icon, label }) => (
          <TenantNavLink count={notificationCount(id)} icon={<Icon size={19} />} isActive={activeTab === id} key={id} label={label} tab={id} />
        ))}
      </nav>
      <SidebarAccountMenu
        // หอกับห้องอยู่ในการ์ดบนสุดของแถบข้างแล้ว ป้ายใต้ชื่อจึงเหลือแค่บทบาท ไม่ซ้ำชื่อหออีกรอบ
        avatarUrl={account.user.avatarUrl}
        displayName={account.user.displayName}
        email={account.user.email}
        role="TENANT"
        roleLabel={primary ? "ผู้เช่า" : "ผู้พักร่วม"}
      />
    </aside>
    <section className="workspace tenant-workspace">
      <header className="topbar tenant-topbar">
        {/* ผู้เช่าบนมือถือใช้แถบเมนูล่างแทนลิ้นชัก จึงไม่มีปุ่มแฮมเบอร์เกอร์บนหัวหน้า */}
        <div className="topbar-heading">
          <div>
            <h1>{activeTabItem.label}</h1>
            <p className="page-subtitle">{tabDescriptions[activeTab]}</p>
          </div>
        </div>
        <div className="tenant-header-actions flex items-center gap-3">
          <PageHeaderTarget />
          {active ? <NotificationCenter footerLink={{ href: tenantPagePath("home"), label: "ดูภาพรวมทั้งหมด" }} isLoading={notificationResource.isLoading} items={tenantNotifications} onRefresh={notificationResource.reload} readOnly={accessState === "read-only"} storageKey={`tenant-notifications:${active.id}`} /> : null}
          {/* จอแคบไม่มีแถบข้าง ห้องที่กำลังดูย่อเป็นป้ายเล็กข้างกระดิ่ง */}
          {active ? <div className="tenant-room-chip-slot"><RoomSwitcher activeId={active.id} disabled={isSwitching} onSwitch={(id) => void switchOccupancy(id)} rooms={activeRooms} variant="chip" /></div> : null}
        </div>
      </header>
    <TenantAccessBanner accessState={accessState} onRetry={() => void notificationResource.reload()} />
    {/* เนื้อของแท็บมาจาก page ของ route นั้น เปลี่ยนแท็บจึงเปลี่ยนเฉพาะตรงนี้ เปลือกอยู่เหมือนเดิม */}
    {/* ระยะของมือถือต้องเป็น utility เหมือนกัน กฎใน CSS ของคอมโพเนนต์แพ้ px-6 py-6 เสมอ */}
    <div className="tenant-content mx-auto max-w-[1500px] px-6 pt-0 pb-24 max-md:px-4 max-md:pb-5">
      <section className="min-w-0">{children}</section>
    </div>
    </section>
    <nav aria-label="เมนูผู้เช่าบนมือถือ" className="tenant-mobile-navigation">
      {mobilePrimaryTabs.filter(({ id }) => primary || !primaryOnlyTabs.has(id)).map(({ id, icon: Icon, label }) => (
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
          {mobileMoreTabs.filter(({ id }) => primary || !primaryOnlyTabs.has(id)).map(({ id, icon: Icon, label }) => (
            <Link aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "active" : ""} href={tenantPagePath(id)} key={id}>
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
              {notificationCount(id) > 0 ? <span className="notification-badge ml-auto">{notificationCount(id) > 99 ? "99+" : notificationCount(id)}</span> : null}
            </Link>
          ))}
          {/* บนมือถือไม่มีแถบข้าง ปุ่มออกจากระบบจึงต้องอยู่ในเมนูนี้ แยกด้วยเส้นกันกดพลาด */}
          <span aria-hidden="true" className="tenant-mobile-more-divider" />
          <button className="tenant-mobile-logout" disabled={isLoggingOut} onClick={() => void logout()} type="button">
            <LogOut aria-hidden="true" size={20} />
            <span>{isLoggingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</span>
          </button>
        </div>
      </details>
    </nav>
    {active && activeTab !== "chat" && !isQuickChatOpen ? (
      <button
        aria-label={(notificationResource.data?.unreadMessages ?? 0) > 0
          ? `เปิดแชทกับหอพัก มีข้อความใหม่ ${notificationResource.data?.unreadMessages ?? 0} ข้อความ`
          : "เปิดแชทกับหอพัก"}
        className="chat-launcher tenant-chat-launcher"
        onClick={() => {
          setQuickChatRequest((current) => ({ nonce: current.nonce + 1, view: "list" }));
          setIsQuickChatOpen(true);
        }}
        type="button"
      >
        <MessageSquare aria-hidden="true" size={25} />
        {(notificationResource.data?.unreadMessages ?? 0) > 0 ? (
          <span className="chat-notification-badge">{Math.min(notificationResource.data?.unreadMessages ?? 0, 99)}</span>
        ) : null}
      </button>
    ) : null}
    {active && activeTab !== "chat" && isQuickChatOpen && !roomResource.isLoading && roomResource.data ? (
      <TenantQuickChat
        initialView={quickChatRequest.view}
        key={quickChatRequest.nonce}
        onClose={() => setIsQuickChatOpen(false)}
        onRead={notificationResource.reload}
        propertyId={roomResource.data.room.property.id}
        propertyName={roomResource.data.room.property.name}
        readOnly={isReadOnly}
        unreadMessages={notificationResource.data?.unreadMessages ?? 0}
      />
    ) : null}
  </NavShell>
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
  // คำถามที่พบบ่อยเปิดได้แม้ยังไม่มีห้องที่อนุมัติ คนที่เพิ่งสมัครมักมีคำถามมากที่สุด
  if (tab === "help") return <TenantHelp canAskDorm={Boolean(active)} />;
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
      <InvoicesPanel initialViews={initialInvoices} onSummaryChanged={notificationResource.reload} readOnly={isReadOnly} />
    </PrimaryOnly>;
  }
  // สัญญา ประกาศ และพัสดุมีหน้าของตัวเองที่ render บนเซิร์ฟเวอร์ ไม่ผ่านตัวนี้
  if (tab === "tickets") return <TicketsPanel initialViews={initialTickets} onUnreadChanged={notificationResource.reload} readOnly={isReadOnly} />;
  if (tab === "chat") return <TenantChatSection isReadOnly={isReadOnly} onRead={notificationResource.reload} roomResource={roomResource} />;
  return null;
}

// บางแท็บเปิดได้เฉพาะผู้เช่าหลัก ผู้พักร่วมเห็นข้อความอธิบายแทนที่จะเห็นหน้าว่าง
function PrimaryOnly({ children, isPrimary, message }: Readonly<{ children: ReactNode; isPrimary: boolean; message: string }>) {
  if (!isPrimary) return <RestrictedPanel message={message} />;
  return <>{children}</>;
}

type Parcel = { id: string; status: string; note: string | null; registeredAt: string; receivedAt: string | null; imageUrl: string | null };

// แชทต้องรู้รหัสหอก่อนถึงเปิดห้องได้ จึงรอข้อมูลห้องให้มาก่อน
function TenantChatSection({ isReadOnly, onRead, roomResource }: Readonly<{
  isReadOnly: boolean;
  onRead: () => unknown;
  roomResource: ReturnType<typeof useTenantPortal>["roomResource"];
}>) {
  if (roomResource.isLoading) return <Loading />;
  if (roomResource.error || !roomResource.data) {
    return <ErrorState error={roomResource.error} retry={() => void roomResource.reload()} />;
  }
  return <TenantChat onRead={onRead} propertyId={roomResource.data.room.property.id} propertyName={roomResource.data.room.property.name} readOnly={isReadOnly} />;
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
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const notify = useToast();
  const isProfileDirty = profile.displayName !== account.user.displayName
    || profile.phone !== account.phone
    || profile.address !== (account.address ?? "")
    || profile.emergencyName !== (account.emergencyName ?? "")
    || profile.emergencyPhone !== (account.emergencyPhone ?? "");
  const isPasswordDirty = Object.values(password).some(Boolean);
  useUnsavedChanges((isProfileDirty || isPasswordDirty) && !isSavingProfile && !isSavingPassword);

  const saveProfile = async () => {
    setIsSavingProfile(true);
    setProfileError("");
    try {
      const updated = await apiData<Account>(await fetch("/api/v1/tenant/me", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      }));
      onUpdated(updated);
      // แจ้งผ่าน toast ที่เดียว เคยขึ้นทั้ง toast และแถบเขียวในหน้าพร้อมกันจนดูซ้ำ
      notify({ message: "บันทึกข้อมูลบัญชีแล้ว" });
    } catch (error) {
      const message = formatClientError(error, "บันทึกข้อมูลไม่สำเร็จ");
      setProfileError(message);
      notify({ message, tone: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async () => {
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
      <AccountProfileCard avatarUrl={account.user.avatarUrl} email={account.user.email} name={account.user.displayName} roleLabel="ผู้เช่า" />

      <AccountFormCard
        action={<button className="primary-button" disabled={isSavingProfile || !isProfileDirty} type="submit">{isSavingProfile ? "กำลังบันทึก..." : "อัปเดต"}</button>}
        description="ใช้ติดต่อคุณ และติดต่อคนใกล้ชิดในกรณีฉุกเฉิน"
        onSubmit={() => void saveProfile()}
        title="ข้อมูลส่วนตัว"
      >
        <div className="account-field-pair">
          <label className="account-field"><span>ชื่อ-นามสกุล</span><input autoComplete="name" maxLength={120} minLength={2} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} required value={profile.displayName} /></label>
          <label className="account-field"><span>เบอร์โทรศัพท์</span><input autoComplete="tel" maxLength={30} minLength={8} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} pattern={PHONE_INPUT_PATTERN} required title="ตัวเลขอย่างน้อย 8 หลัก ใส่ขีดหรือ + นำหน้าได้" type="tel" value={profile.phone} /></label>
        </div>
        <AccountReadOnlyField hint="เปลี่ยนได้โดยผู้ดูแลหอพัก" label="อีเมลสำหรับเข้าสู่ระบบ" value={account.user.email} />
        <label className="account-field"><span>ที่อยู่ (ไม่บังคับ)</span><textarea maxLength={1000} onChange={(event) => setProfile({ ...profile, address: event.target.value })} rows={2} value={profile.address} /></label>
        <div className="account-field-pair">
          <label className="account-field"><span>ผู้ติดต่อฉุกเฉิน</span><input maxLength={160} onChange={(event) => setProfile({ ...profile, emergencyName: event.target.value })} value={profile.emergencyName} /></label>
          <label className="account-field"><span>เบอร์ฉุกเฉิน</span><input maxLength={30} onChange={(event) => setProfile({ ...profile, emergencyPhone: event.target.value })} type="tel" value={profile.emergencyPhone} /></label>
        </div>
        {profileError ? <p className="account-settings-message error" role="alert">{profileError}</p> : null}
      </AccountFormCard>

      <AccountFormCard
        action={<button className="primary-button" disabled={isSavingPassword || !password.currentPassword || !password.newPassword || !password.confirmPassword} type="submit">{isSavingPassword ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}</button>}
        description="ใช้รหัสผ่านที่เดายากและไม่ซ้ำกับเว็บอื่น"
        hint="เปลี่ยนแล้วระบบจะออกจากระบบทุกอุปกรณ์"
        onSubmit={() => void changePassword()}
        title="ความปลอดภัย"
      >
        <label className="account-field"><span>รหัสผ่านปัจจุบัน</span><input autoComplete="current-password" maxLength={256} onChange={(event) => { setPassword({ ...password, currentPassword: event.target.value }); setPasswordError(""); }} required type="password" value={password.currentPassword} /></label>
        <div className="account-field-pair">
          <label className="account-field"><span>รหัสผ่านใหม่</span><input aria-describedby="tenant-password-requirements" autoComplete="new-password" maxLength={128} minLength={12} onChange={(event) => { setPassword({ ...password, newPassword: event.target.value }); setPasswordError(""); }} required type="password" value={password.newPassword} /></label>
          <label className="account-field"><span>ยืนยันรหัสผ่านใหม่</span><input autoComplete="new-password" maxLength={128} minLength={12} onChange={(event) => { setPassword({ ...password, confirmPassword: event.target.value }); setPasswordError(""); }} required type="password" value={password.confirmPassword} /></label>
        </div>
        {password.newPassword ? <PasswordRequirements confirmation={password.confirmPassword} currentPassword={password.currentPassword} id="tenant-password-requirements" password={password.newPassword} /> : null}
        {passwordError ? <p className="account-settings-message error" role="alert">{passwordError}</p> : null}
      </AccountFormCard>

      <AccountCard description="ห้องที่คุณเคยและกำลังเข้าพัก" title="การเข้าพักของฉัน">
        <div className="account-occupancy-list">
        {account.occupancies.length ? account.occupancies.map((occupancy) => <article className="account-occupancy-row" key={occupancy.id}>
          <div>
            <strong>{occupancy.property.name} · ห้อง {occupancy.room.number}</strong>
            <p className="text-sm text-[#62646c]">
              {occupancy.role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}
              {occupancy.startedAt ? ` · เริ่ม ${formatThaiDate(occupancy.startedAt)}` : ""}
              {occupancy.endedAt ? ` · สิ้นสุด ${formatThaiDate(occupancy.endedAt)}` : ""}
            </p>
          </div>
          <span className="badge">{occupancyLabels[occupancy.status]}</span>
        </article>) : <Empty description="เมื่อเจ้าของหอเพิ่มคุณเข้าห้องแล้ว ข้อมูลห้องและบริการจะแสดงที่นี่" icon={<Home />} text="ยังไม่มีข้อมูลการเข้าพัก" />}
        </div>
        <div className="account-card-footer">
        <AcceptInvitationForm onAccepted={refreshAccount} />
        </div>
      </AccountCard>
      <PrivacyPreferencesPanel />
    </div>

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

    <section aria-labelledby="tenant-overview-title" className="tenant-overview">
      <h2 className="tenant-overview-title" id="tenant-overview-title">ภาพรวมที่ต้องรู้</h2>
      <TenantBillHero invoice={unpaidInvoice} isLoading={invoices.isLoading} isPrimary={isPrimary} />
      <nav aria-label="บริการของหอ" className="tenant-service-grid">
        <TenantServiceTile
          count={summary?.waitingParcels ?? 0}
          detail={waitingParcel ? `${waitingParcel.note || "พัสดุใหม่"} · ${formatThaiDate(waitingParcel.registeredAt)}` : "ไม่มีพัสดุรอรับ"}
          href={tenantPagePath("parcels")}
          icon={<Package size={20} />}
          label="พัสดุรอรับ"
        />
        {/* ตัวเลขตรงกับป้ายบนเมนูแจ้งเรื่อง คือคำตอบใหม่ที่ยังไม่ได้อ่าน ส่วนจำนวนเรื่องที่รอหออยู่บอกเป็นข้อความ */}
        <TenantServiceTile
          count={summary?.unreadTicketReplies ?? 0}
          detail={summary?.unreadTicketReplies
            ? `มีคำตอบใหม่ ${summary.unreadTicketReplies} เรื่อง`
            : openTicket ? `${summary?.openTickets ?? 1} เรื่อง · ${openTicket.title}` : "แจ้งซ่อมหรือร้องเรียนได้ตลอด"}
          href={tenantPagePath("tickets")}
          icon={<Wrench size={20} />}
          label="เรื่องที่กำลังติดตาม"
        />
        {isPrimary ? <TenantServiceTile count={0} detail="ดูสัญญาและวันสิ้นสุด" href={tenantPagePath("lease")} icon={<FileText size={20} />} label="สัญญาเช่า" /> : <TenantServiceTile count={0} detail="ข่าวและประกาศจากหอ" href={tenantPagePath("announcements")} icon={<Bell size={20} />} label="ประกาศ" />}
        <TenantServiceTile count={summary?.unreadMessages ?? 0} detail="คุยกับเจ้าของหอโดยตรง" href={tenantPagePath("chat")} icon={<MessageSquare size={20} />} label="ติดต่อหอ" />
      </nav>
    </section>

    <AppSection description="รายละเอียดห้องที่กำลังเข้าพัก" icon={<Home />} title="ข้อมูลห้อง">
    <div className="grid gap-4 sm:grid-cols-3">
      <InfoCard label="ค่าเช่าต่อเดือน" value={currency.format(Number(room.monthlyRent))} />
      <InfoCard label="ประเภทห้อง" value={room.roomType} />
      <InfoCard label="เริ่มเข้าพัก" value={startedAt ? formatThaiDate(startedAt) : "-"} />
    </div>

    <details className="rounded-xl border border-[#e4e4e7] bg-[#fff] p-4 group">
      <summary className="cursor-pointer list-none text-sm font-semibold">ข้อมูลห้องและช่องทางติดต่อ</summary>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Info label="ที่อยู่" value={room.property.settings?.address ?? "-"} />
        <Info label="โทรศัพท์" value={formatThaiPhone(room.property.settings?.contactPhone) || "-"} />
        <Info label="อีเมล" value={room.property.settings?.contactEmail ?? "-"} />
        <Info label="ติดต่อฉุกเฉิน" value={room.property.settings?.emergencyContact ?? "-"} />
        <Info label="อุปกรณ์ในห้อง" value={furniture.join(", ") || "-"} />
        <Info label="เบอร์ผู้เช่า" value={formatThaiPhone(account.phone) || "-"} />
      </dl>
      {room.property.settings?.houseRules ? <div className="mt-5 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-4"><strong>กฎของหอพัก</strong><p className="mt-2 whitespace-pre-wrap">{room.property.settings.houseRules}</p></div> : null}
    </details>
    </AppSection>
    </div>
  </div>;
}

// การ์ดบิลใหญ่บนสุดของหน้าแรก บิลค้างคือเรื่องที่ผู้เช่าต้องทำก่อนอย่างอื่น จึงเห็นยอดกับปุ่มจ่ายทันที
// ส่งสลิปไปแล้วเปลี่ยนเป็นบอกว่ารอเจ้าของหอตรวจ ผู้พักร่วมไม่มีบิลของตัวเองจึงบอกว่าเป็นของผู้เช่าหลัก
function TenantBillHero({ invoice, isLoading, isPrimary }: Readonly<{ invoice: Invoice | undefined; isLoading: boolean; isPrimary: boolean }>) {
  if (!isPrimary) {
    return <article className="tenant-bill-hero" data-state="clear">
      <p className="tenant-bill-hero-label">ยอดที่ต้องชำระ</p>
      <strong className="tenant-bill-hero-amount">-</strong>
      <p className="tenant-bill-hero-note">บิลและการชำระเงินเป็นของผู้เช่าหลักของห้อง</p>
    </article>;
  }
  if (isLoading && !invoice) return <article className="tenant-bill-hero"><Loading /></article>;
  if (!invoice) {
    return <article className="tenant-bill-hero" data-state="clear">
      <p className="tenant-bill-hero-label">ยอดที่ต้องชำระ</p>
      <strong className="tenant-bill-hero-amount">฿0</strong>
      <p className="tenant-bill-hero-note"><CheckCircle2 aria-hidden="true" size={16} /> ไม่มีบิลค้าง จ่ายครบทุกบิลแล้ว</p>
    </article>;
  }
  const due = describeInvoiceDue(invoice.dueDate);
  const late = invoice.status === "OVERDUE" || due.isLate;
  const waitingReview = Boolean(invoice.hasPendingSubmission);
  return <article aria-label="บิลที่ต้องชำระ" className="tenant-bill-hero">
    <div className="tenant-bill-hero-head">
      <p className="tenant-bill-hero-label">ยอดที่ต้องชำระ</p>
      <span className="today-label" data-tone={waitingReview ? "neutral" : late ? "urgent" : "pending"}>{waitingReview ? "ส่งสลิปแล้ว รอตรวจ" : due.text}</span>
    </div>
    <strong className="tenant-bill-hero-amount">{currency.format(Number(invoice.total))}</strong>
    <p className="tenant-bill-hero-note">บิลเดือน{formatThaiMonth(invoice.billingMonth.slice(0, 7))} · {invoice.invoiceNumber}</p>
    <Link className="primary-button tenant-bill-hero-action" href={tenantPagePath("invoices")}>
      {waitingReview ? "ดูสถานะบิล" : "จ่ายบิลนี้"} <ArrowRight aria-hidden="true" size={18} />
    </Link>
    {waitingReview ? null : <p className="tenant-bill-hero-hint">ดูช่องทางโอนและแนบสลิปได้ในหน้าบิล</p>}
  </article>;
}

// ทางลัดไปบริการของหอ ตัวเลขเหลืองบอกว่ามีเรื่องรออยู่
function TenantServiceTile({ count, detail, href, icon, label }: Readonly<{
  count: number;
  detail: string;
  href: string;
  icon: ReactNode;
  label: string;
}>) {
  return <Link className="tenant-service-tile" href={href}>
    <span className="tenant-service-icon">{icon}</span>
    <span className="tenant-service-copy">
      <strong>{label}</strong>
      <small>{detail}</small>
    </span>
    {count > 0 ? <span aria-label={`${count} รายการ`} className="notification-badge">{count > 99 ? "99+" : count}</span> : null}
  </Link>;
}

type Invoice = { id: string; invoiceNumber: string; billingMonth: string; status: string; dueDate: string; total: string; paidAt: string | null; cancelledAt: string | null; hasPendingSubmission?: boolean };
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
  return <div aria-label="เลือกประเภทข้อมูล" className="figma-inline-tabs invoice-tabs" onKeyDown={handleKeyDown} role="tablist" tabIndex={-1}>
    {tabs.map((tab) => <button aria-controls={`${id}-panel`} aria-selected={view === tab.value} className={view === tab.value ? "active" : ""} id={`${id}-tab-${tab.value}`} key={tab.value} onClick={() => onChange(tab.value)} role="tab" tabIndex={view === tab.value ? 0 : -1} type="button">
      {tab.label}
    </button>)}
  </div>;
}

function InvoicesPanel({ initialViews, onSummaryChanged, readOnly }: Readonly<{ initialViews?: TenantInitialViews<Invoice> | null; onSummaryChanged: () => Promise<void>; readOnly: boolean }>) {
  const [view, setView] = useState<TenantRecordView>("current");
  const currentResource = usePaginatedResource<Invoice>("/api/v1/tenant/invoices?view=current", 20, initialViews?.current ?? null);
  const historyResource = usePaginatedResource<Invoice>("/api/v1/tenant/invoices?view=history", 20, initialViews?.history ?? null, view === "history");
  const reloadCurrentInvoices = currentResource.reload;
  const reloadInvoiceHistory = historyResource.reload;
  const resource = view === "current" ? currentResource : historyResource;
  // undefined คือผู้ใช้ยังไม่ได้กดเลือกเอง ตอนนั้นเปิดบิลที่ต้องจ่ายใบแรกไว้ให้เลย จะได้เห็น QR ทันทีไม่ต้องกดขยายหา
  const [chosenInvoiceId, setChosenInvoiceId] = useState<string | null | undefined>(undefined);
  const firstPayableId = view === "current"
    ? currentResource.data.find((invoice) => ["PENDING", "OVERDUE"].includes(invoice.status))?.id ?? null
    : null;
  const expandedInvoiceId = chosenInvoiceId === undefined ? firstPayableId : chosenInvoiceId;

  const changeView = (nextView: TenantRecordView) => {
    setChosenInvoiceId(null);
    setView(nextView);
  };

  // บิลใบเดียวอาจถูกแก้จากทั้งสองมุมมอง โหลดใหม่ทั้งคู่จะได้ไม่ค้างของเก่า
  // ส่งสลิปแล้วป้ายบิลบนเมนูต้องหายด้วย จึงโหลดยอดแจ้งเตือนใหม่ไปพร้อมกัน
  const reloadInvoices = useCallback(async () => {
    await Promise.all([reloadCurrentInvoices(), reloadInvoiceHistory(), onSummaryChanged()]);
  }, [onSummaryChanged, reloadCurrentInvoices, reloadInvoiceHistory]);

  const toggleExpanded = (invoiceId: string) => {
    setChosenInvoiceId(expandedInvoiceId === invoiceId ? null : invoiceId);
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
  if (resource.isLoading && !resource.data.length) return <Loading />;
  if (resource.error && !resource.data.length) return <ErrorState error={resource.error} retry={() => void resource.reload()} />;
  if (resource.data.length === 0) {
    return view === "current"
      ? <Empty description="เมื่อถึงรอบบิลถัดไป รายการจะมาแสดงที่นี่" icon={<ReceiptText />} text="ไม่มีบิลที่ต้องดำเนินการ" />
      : <Empty description="บิลที่ชำระเสร็จแล้วจะย้ายมาเก็บไว้ที่นี่" icon={<ReceiptText />} text="ยังไม่มีประวัติบิล" />;
  }
  if (view === "history") return <InvoiceHistoryList {...props} />;
  return <InvoiceCards {...props} />;
}

// มุมมองประวัติเป็นรายการแบบมีเส้นคั่น กดแถวแล้วกางรายละเอียดอยู่ในแถวเดิม
// เคยเป็นตารางหกคอลัมน์ ซึ่งบนมือถือดันหน้าให้กว้างจนต้องเลื่อนข้าง
function InvoiceHistoryList({ expandedInvoiceId, historyTotal, onChanged, onToggle, readOnly, resource }: InvoiceListProps) {
  return <div className="grid gap-3">
    <p className="tenant-month-heading">{historyTotal === null ? "ประวัติบิล" : `ทั้งหมด ${historyTotal.toLocaleString("th-TH")} บิล`}</p>
    <ul aria-label="ประวัติบิล" className="tenant-record-list">{resource.data.map((invoice) => {
      const isExpanded = expandedInvoiceId === invoice.id;
      const panelId = `tenant-invoice-details-${invoice.id}`;
      const isPaid = invoice.status === "PAID";
      const completedAt = invoice.paidAt ?? invoice.cancelledAt;
      return <li key={invoice.id}>
        <button aria-controls={panelId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียดบิล ${invoice.invoiceNumber}`} className="tenant-record-row tenant-record-toggle" onClick={() => onToggle(invoice.id)} type="button">
          <span aria-hidden="true" className="tenant-icon-tile" data-size="sm" data-tone={isPaid ? "success" : undefined}>{isPaid ? <Check size={17} /> : <X size={17} />}</span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[#292a30]">{formatThaiMonth(invoice.billingMonth.slice(0, 7))}</strong>
            <span className="block break-words text-sm text-[#62646c]">{invoice.invoiceNumber}{completedAt ? ` · ${isPaid ? "ชำระ" : "ยกเลิก"} ${formatThaiDate(completedAt)}` : ""}</span>
          </span>
          <span className="grid shrink-0 justify-items-end gap-1">
            <strong className="text-[#292a30]">{currency.format(Number(invoice.total))}</strong>
            <Status kind="invoice" value={invoice.status} />
          </span>
          <ChevronDown aria-hidden="true" className={`shrink-0 text-[#8b8d96] transition-transform ${isExpanded ? "rotate-180" : ""}`} size={18} />
        </button>
        {isExpanded ? <InvoiceDetails id={panelId} invoice={invoice} onChanged={onChanged} readOnly={readOnly} /> : null}
      </li>;
    })}</ul>
  </div>;
}

// มุมมองปัจจุบันเป็นการ์ด กดแล้วกางรายละเอียดอยู่ในการ์ดเดิม
function InvoiceCards({ expandedInvoiceId, onChanged, onToggle, readOnly, resource }: InvoiceListProps) {
  return <div className="grid gap-3">
    {resource.data.map((invoice) => {
      const isExpanded = expandedInvoiceId === invoice.id;
      const panelId = `tenant-invoice-details-${invoice.id}`;
      return <article className={`panel overflow-hidden p-0 transition ${isExpanded ? "border-brand" : ""}`} key={invoice.id}>
        <button aria-controls={panelId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียดบิล ${invoice.invoiceNumber} ยอด ${currency.format(Number(invoice.total))} สถานะ ${formatInvoiceStatus(invoice.status)}`} className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-brand/[.03]" onClick={() => onToggle(invoice.id)} type="button">
          <span className="min-w-0"><strong className="block text-lg whitespace-nowrap">{invoice.invoiceNumber}</strong><small>{formatThaiMonth(invoice.billingMonth.slice(0, 7))} · <InvoiceDueText invoice={invoice} /></small></span>
          <span className="flex shrink-0 items-center gap-4 text-right">
            <span><strong className="block text-xl">{currency.format(Number(invoice.total))}</strong><InvoiceStatus invoice={invoice} /></span>
            <span className="grid size-10 place-items-center rounded-xl bg-[#f1f1f3] text-[#555761]" title={isExpanded ? "ยุบรายละเอียด" : "ขยายรายละเอียด"}><ChevronDown aria-hidden="true" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={20} /></span>
          </span>
        </button>
        {isExpanded ? <InvoiceDetails id={panelId} invoice={invoice} onChanged={onChanged} readOnly={readOnly} /> : null}
      </article>;
    })}
  </div>;
}

// ส่งสลิปแล้วรอหอตรวจ บอกให้ผู้เช่ารู้ว่าทำส่วนของตัวเองเสร็จแล้ว ไม่ใช่ยังขึ้นว่าเกินกำหนดอยู่
function InvoiceStatus({ invoice }: Readonly<{ invoice: Invoice }>) {
  if (invoice.hasPendingSubmission && ["PENDING", "OVERDUE"].includes(invoice.status)) {
    return <span className="badge badge-pending">รอตรวจสอบสลิป</span>;
  }
  return <Status kind="invoice" value={invoice.status} />;
}

// บิลที่ยังค้างบอกเป็นจำนวนวัน เลยกำหนดแล้วเป็นสีแดง บิลที่จ่ายหรือยกเลิกแล้วบอกแค่วันครบกำหนด
function InvoiceDueText({ invoice }: Readonly<{ invoice: Invoice }>) {
  if (!["PENDING", "OVERDUE"].includes(invoice.status)) return <>ครบกำหนด {formatThaiDate(invoice.dueDate)}</>;
  // ส่งสลิปแล้ว ส่วนของผู้เช่าจบแล้ว ไม่ต้องเร่งด้วยตัวแดงว่าเลยกำหนดอีก ป้ายข้าง ๆ บอกว่ารอตรวจอยู่แล้ว
  if (invoice.hasPendingSubmission) return <>ครบกำหนด {formatThaiDate(invoice.dueDate)}</>;
  const due = describeInvoiceDue(invoice.dueDate);
  return <span className={due.isLate ? "font-semibold text-[#dc2626]" : undefined}>{due.text}</span>;
}

function InvoiceDetails({ id, invoice, onChanged, readOnly }: Readonly<{ id: string; invoice: Invoice; onChanged: () => Promise<void>; readOnly: boolean }>) {
  const detail = useApiResource<InvoiceDetail>(`/api/v1/tenant/invoices/${invoice.id}`);
  const submissions = useApiResource<Submission[]>(`/api/v1/tenant/invoices/${invoice.id}/payment-submissions`);
  // ชำระได้เฉพาะบิลที่ยังค้างอยู่ บิลที่จ่ายแล้วหรือยกเลิกแล้วเปิดดูได้อย่างเดียว
  const payable = ["PENDING", "OVERDUE"].includes(invoice.status);

  return <section aria-label={`รายละเอียดบิล ${invoice.invoiceNumber}`} className="border-t border-[#e4e4e7] bg-[#fcfcfe] p-5" id={id}>
    <InvoiceLineItems detail={detail} />
    {/* จ่ายแล้วเปิดใบเสร็จได้ทันที ระบบสร้างจากบิลจริงทุกครั้ง เปิดในแท็บใหม่เพื่อบันทึกหรือพิมพ์ */}
    {invoice.status === "PAID" ? <a className="secondary-button tenant-receipt-link" href={`/api/v1/tenant/invoices/${invoice.id}/receipt`} rel="noreferrer" target="_blank">
      <FileCheck2 aria-hidden="true" size={17} /> ดาวน์โหลดใบเสร็จรับเงิน (PDF)
    </a> : null}
    <InvoicePaymentBox
      invoice={invoice}
      onSubmitted={async () => { await Promise.all([submissions.reload(), onChanged()]); }}
      payable={payable}
      readOnly={readOnly}
    />
    {/* บิลที่ปิดไปแล้วโดยไม่มีสลิป เช่นจ่ายเงินสดที่หอ ไม่ต้องขึ้นว่ายังไม่เคยส่งหลักฐาน เพราะไม่มีอะไรต้องส่งแล้ว */}
    {payable || submissions.data?.length ? <SubmissionHistory submissions={submissions.data} /> : null}
  </section>;
}

// รายการค่าใช้จ่ายในบิล กำลังโหลด โหลดได้ หรือโหลดไม่สำเร็จ
function InvoiceLineItems({ detail }: Readonly<{ detail: ReturnType<typeof useApiResource<InvoiceDetail>> }>) {
  if (detail.isLoading) return <Loading />;
  if (!detail.data) return <ErrorState error={detail.error} retry={() => void detail.reload()} />;
  // จัดเป็นตารางรายการแบบใบแจ้งหนี้ ตัวเลขชิดขวาเรียงหลักตรงกัน แล้วปิดท้ายด้วยยอดรวม
  // ค่าปรับล่าช้าเป็นรายการหนึ่งในบิลอยู่แล้ว จึงไม่ต้องแยกแถวซ้ำ
  return <dl className="tenant-invoice-lines">
    {detail.data.items.map((item) => <div key={item.id}>
      <dt>
        {item.description}
        {/* จำนวน 1 ไม่ต้องบอก บอกเฉพาะรายการที่คิดหลายหน่วย จะได้เห็นว่าคิดหน่วยละเท่าไร */}
        {Number(item.quantity) === 1 ? null : <small>{Number(item.quantity).toLocaleString("th-TH")} × {currency.format(Number(item.unitPrice))}</small>}
      </dt>
      <dd>{currency.format(Number(item.amount))}</dd>
    </div>)}
    <div className="is-total"><dt>รวมทั้งสิ้น</dt><dd>{currency.format(Number(detail.data.total))}</dd></div>
  </dl>;
}

// กล่องชำระเงิน มี QR พร้อมเพย์และช่องอัปโหลดสลิป
function InvoicePaymentBox({ invoice, onSubmitted, payable, readOnly }: Readonly<{
  invoice: Invoice;
  onSubmitted: () => Promise<void>;
  payable: boolean;
  readOnly: boolean;
}>) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);

  // คืนหน่วยความจำของรูปตัวอย่างเมื่อเปลี่ยนรูปหรือออกจากหน้า
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  if (!payable) return null;
  if (readOnly) return <ReadOnlyNotice className="mt-5">ตรวจสอบรายละเอียดและประวัติหลักฐานได้ แต่ไม่สามารถชำระหรือส่งสลิปใหม่ได้</ReadOnlyNotice>;
  // ส่งสลิปไปแล้ว ไม่ต้องโชว์ QR กับช่องแนบสลิปเต็ม ๆ ให้ดูเหมือนยังไม่ได้จ่าย
  // แต่ยังเปิดส่งใหม่ได้ เผื่อแนบผิดใบหรือโอนเพิ่ม
  if (invoice.hasPendingSubmission && !isResubmitting) {
    return <div className="tenant-pay-pending">
      <Clock3 aria-hidden="true" className="shrink-0 text-[#92400e]" size={20} />
      <div className="min-w-48 flex-1">
        <strong className="block text-[#78350f]">ส่งสลิปแล้ว รอหอตรวจสอบ</strong>
        <span className="block text-sm text-[#92400e]">หอยืนยันยอดแล้วบิลจะย้ายไปอยู่ในประวัติ ถ้าแนบผิดใบหรือต้องโอนเพิ่ม ส่งสลิปใหม่ได้</span>
        <Link className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#92400e] underline" href={`${tenantPagePath("help")}#slip-review`}><CircleHelp aria-hidden="true" size={14} /> ปกติใช้เวลานานแค่ไหน</Link>
      </div>
      <button className="secondary-button shrink-0" onClick={() => setIsResubmitting(true)} type="button"><QrCode aria-hidden="true" size={17} /> ส่งสลิปใหม่</button>
    </div>;
  }

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
      setPreviewUrl(null);
      setIsResubmitting(false);
      await onSubmitted();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "ส่งสลิปไม่สำเร็จ");
    } finally {
      setIsSending(false);
    }
  };

  // เลือกไฟล์แล้วโชว์รูปสลิปให้เห็นทันที ผู้เช่าจะได้แน่ใจว่าแนบรูปถูกใบก่อนกดส่ง
  // ไฟล์ใหญ่เกินบอกตั้งแต่ตอนเลือก ไม่ต้องรออัปโหลดแล้วค่อยรู้ เซิร์ฟเวอร์ยังตรวจซ้ำอีกชั้น
  const chooseFile = (nextFile: File | null) => {
    setError("");
    if (nextFile && nextFile.size > slipMaxBytes) {
      setFile(null);
      setPreviewUrl(null);
      setError("ไฟล์ใหญ่เกิน 5 MB กรุณาเลือกรูปสลิปที่เล็กลง");
      return;
    }
    setFile(nextFile);
    setPreviewUrl(nextFile?.type.startsWith("image/") ? URL.createObjectURL(nextFile) : null);
  };

  // แบ่งเป็นสองขั้นตามลำดับที่ผู้เช่าทำจริง โอนก่อนแล้วค่อยแนบสลิป
  return <div className="pay-steps">
    <section aria-labelledby={`pay-step-transfer-${invoice.id}`} className="pay-step">
      <h3 id={`pay-step-transfer-${invoice.id}`}><span aria-hidden="true">1</span>โอนเงิน</h3>
      <PaymentChannels invoice={invoice} />
    </section>
    <section aria-labelledby={`pay-step-slip-${invoice.id}`} className="pay-step">
    <h3 id={`pay-step-slip-${invoice.id}`}><span aria-hidden="true">2</span>แนบสลิป</h3>
    <label className="slip-picker">
      <input accept="image/png,image/jpeg,application/pdf,.pdf" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} type="file" />
      {previewUrl
        ? <Image alt="ตัวอย่างสลิปที่เลือก" className="slip-picker-preview" height={96} src={previewUrl} unoptimized width={96} />
        : <span className="slip-picker-icon">{file ? <FileText aria-hidden="true" size={26} /> : <ImagePlus aria-hidden="true" size={26} />}</span>}
      <span className="min-w-0">
        <strong className="block truncate">{file ? file.name : "แนบสลิปโอนเงิน"}</strong>
        <small className="block">{file ? "แตะเพื่อเปลี่ยนไฟล์" : "รูปภาพหรือ PDF ไม่เกิน 5 MB"}</small>
      </span>
    </label>
    {error ? <p className="form-alert error" role="alert">{error}</p> : null}
    <button className="primary-button" disabled={!file || isSending} onClick={() => void submit()} type="button">
      <Upload size={17} />{isSending ? "กำลังส่ง..." : "ส่งหลักฐาน"}
    </button>
    </section>
  </div>;
}

// ประวัติสลิปที่เคยส่งไป พร้อมเหตุผลเมื่อถูกปฏิเสธ
function SubmissionHistory({ submissions }: Readonly<{ submissions: Submission[] | null }>) {
  // ใช้กรอบรายการแบบเดียวกับรายการในบิลด้านบน ทั้งบิลจะได้ดูเป็นชุดเดียวกัน
  return <div className="mt-5">
    <h3 className="mb-2 text-sm font-semibold text-[#292a30]">ประวัติหลักฐาน</h3>
    {submissions?.length ? <dl className="tenant-invoice-lines">
      {submissions.map((item) => <div key={item.id}>
        <dt>
          {formatThaiDateTime(item.submittedAt)}
          {item.rejectionNote ? <small>{item.rejectionNote}</small> : null}
        </dt>
        <dd><Status value={item.status} /></dd>
      </div>)}
    </dl> : null}
    {submissions?.length === 0 ? <p className="text-sm text-[#62646c]">ยังไม่เคยส่งหลักฐาน</p> : null}
  </div>;
}

// ขนาดเดียวกับที่เซิร์ฟเวอร์รับ เช็กก่อนส่งเพื่อบอกผู้เช่าได้เร็วขึ้น
const slipMaxBytes = 5 * 1024 * 1024;

// ช่องทางโอนเงินของบิลหนึ่งใบ QR ก่อน ไม่มี QR ใช้บัญชีธนาคาร ไม่มีทั้งคู่บอกให้ถามหอ
// ข้อความผิดพลาดจากการสร้าง QR เขียนไว้ให้เจ้าของหออ่าน (เช่นแพ็กเกจไม่รองรับ) จึงไม่ส่งต่อให้ผู้เช่าเห็นตรง ๆ
function PaymentChannels({ invoice }: Readonly<{ invoice: Invoice }>) {
  const promptPay = useApiResource<{ invoiceNumber: string; amount: string; payload: string }>(`/api/v1/tenant/invoices/${invoice.id}/promptpay-qr?format=json`);
  const account = useApiResource<{ bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null }>(`/api/v1/tenant/invoices/${invoice.id}/payment-account`);
  if (promptPay.isLoading || account.isLoading) return <Loading />;
  const bank = account.data?.bankAccountNumber ? account.data : null;
  if (!promptPay.data && !bank) {
    return <div className="tenant-pay-pending mt-0">
      <AlertCircle aria-hidden="true" className="shrink-0 text-[#92400e]" size={20} />
      <div className="min-w-48 flex-1">
        <strong className="block text-[#78350f]">หอยังไม่ได้ตั้งช่องทางรับเงินในระบบ</strong>
        <span className="block text-sm text-[#92400e]">ถามหอว่าให้โอนทางไหน ยอดที่ต้องโอนคือ {currency.format(Number(invoice.total))} โอนแล้วแนบสลิปในขั้นถัดไป</span>
      </div>
      <AskDormButton label="ถามหอในแชท" />
    </div>;
  }
  return <div className="grid gap-4">
    {promptPay.data ? <div className="text-center">
      <strong className="block text-lg">สแกน PromptPay</strong>
      <Image alt={`PromptPay QR ${invoice.invoiceNumber}`} className="mx-auto mt-3 rounded-xl" height={240} src={`/api/v1/tenant/invoices/${invoice.id}/promptpay-qr`} unoptimized width={240} />
      <p className="mt-2 text-sm text-[#55575f]">ยอด {currency.format(Number(promptPay.data.amount))}</p>
      {/* สแกน QR บนจอมือถือเครื่องเดียวกันไม่ได้ ต้องบันทึกรูปแล้วเปิดในแอปธนาคาร ปุ่มนี้จึงสำคัญกับคนจ่ายผ่านมือถือ */}
      <a className="secondary-button mt-3 inline-flex" download={`promptpay-${invoice.invoiceNumber}.png`} href={`/api/v1/tenant/invoices/${invoice.id}/promptpay-qr`}>
        <Download aria-hidden="true" size={17} /> บันทึกรูป QR
      </a>
      <p className="mt-2 text-xs text-[#55575f]">บันทึกรูปแล้วเปิดในแอปธนาคาร เลือก “สแกนจากรูปภาพ”</p>
    </div> : null}
    {bank ? <dl className="grid gap-1 rounded-xl bg-[#f3f3f5] p-3 text-center text-sm" data-testid="tenant-bank-account">
      {/* ไม่มี QR บัญชีธนาคารคือช่องทางหลัก จึงบอกยอดที่ต้องโอนไว้ตรงนี้ด้วย */}
      <dt className="text-[#55575f]">{promptPay.data ? "หรือโอนเข้าบัญชี" : `โอน ${currency.format(Number(invoice.total))} เข้าบัญชีของหอ`}</dt>
      <dd className="font-bold">{bank.bankName}</dd>
      {/* โชว์แบบมีขีดคั่นให้อ่านตรวจง่าย แต่คัดลอกเฉพาะตัวเลข วางในแอปธนาคารได้ทันที */}
      <dd className="flex flex-wrap items-center justify-center gap-2">
        <span className="font-mono text-lg tracking-wide">{formatBankAccount(bank.bankAccountNumber)}</span>
        <CopyButton label="เลขบัญชี" value={(bank.bankAccountNumber ?? "").replace(/\D/g, "")} />
      </dd>
      <dd>{bank.bankAccountName}</dd>
    </dl> : null}
  </div>;
}

type Ticket = {
  id: string; type: "REPAIR" | "COMPLAINT"; status: TicketInboxStatus; priority: string;
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
  // ตัวเลขในกระดิ่งนับเรื่องที่ยังเปิดอยู่ด้วย จึงโหลดยอดแจ้งเตือนใหม่ไปพร้อมกัน
  const reloadTickets = useCallback(async () => {
    await Promise.all([reloadCurrentTickets(), reloadTicketHistory(), onUnreadChanged()]);
  }, [onUnreadChanged, reloadCurrentTickets, reloadTicketHistory]);

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
        onCreate={readOnly ? undefined : () => setIsOpen(true)}
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
  onCreate?: () => void;
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
  if (resource.isLoading && !resource.data.length) return <Loading />;
  if (resource.error && !resource.data.length) return <ErrorState error={resource.error} retry={() => void resource.reload()} />;
  if (resource.data.length === 0) {
    if (view === "history") return <Empty description="เรื่องที่เสร็จหรือยกเลิกแล้วจะย้ายมาเก็บไว้ที่นี่" icon={<Wrench />} text="ยังไม่มีประวัติเรื่อง" />;
    return <Empty
      action={props.onCreate ? <button className="secondary-button" onClick={props.onCreate} type="button"><Plus aria-hidden="true" size={17} /> แจ้งเรื่องใหม่</button> : null}
      description="แจ้งซ่อมของในห้อง หรือร้องเรียนเรื่องเสียงดังและความสะอาด เลือกไม่ระบุชื่อได้"
      icon={<Wrench />}
      text="ไม่มีเรื่องที่กำลังดำเนินการ"
    />;
  }
  if (view === "history") return <TicketHistoryList {...props} />;
  return <TicketCards {...props} />;
}

// มุมมองประวัติเป็นรายการแบบมีเส้นคั่น กดแถวแล้วกางรายละเอียดกับการตอบกลับอยู่ในแถวเดิม
function TicketHistoryList({ historyTotal, onRead, onToggleReply, openReplyTicketId, readOnly, resource }: TicketListProps) {
  return <div className="grid gap-3">
    <p className="tenant-month-heading">{historyTotal === null ? "ประวัติเรื่องแจ้ง" : `ทั้งหมด ${historyTotal.toLocaleString("th-TH")} เรื่อง`}</p>
    <ul aria-label="ประวัติเรื่องแจ้ง" className="tenant-record-list">{resource.data.map((ticket) => {
      const isExpanded = openReplyTicketId === ticket.id;
      const detailsId = `tenant-ticket-history-${ticket.id}`;
      return <li key={ticket.id}>
        <button aria-controls={detailsId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียด ${ticket.title}`} className="tenant-record-row tenant-record-toggle" onClick={() => onToggleReply(ticket.id)} type="button">
          <span aria-hidden="true" className="chat-ticket-icon" data-size="sm" data-tone={ticketStatusTone(ticket.status)}><TicketIcon size={16} type={ticket.type} /></span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[#292a30]">{ticket.title}</strong>
            <span className="block text-sm text-[#62646c]">{ticketTypeLabel(ticket.type)} · แจ้ง {formatThaiDate(ticket.createdAt)}</span>
          </span>
          <Status kind="ticket" value={ticket.status} />
          <ChevronDown aria-hidden="true" className={`shrink-0 text-[#8b8d96] transition-transform ${isExpanded ? "rotate-180" : ""}`} size={18} />
        </button>
        {isExpanded ? <div className="border-t border-dashed border-[#e4e4e7] bg-[#fcfcfe] px-4 py-4" id={detailsId}>
          <TicketBody onRead={onRead} readOnly={readOnly} showReplyThread ticket={ticket} />
        </div> : null}
      </li>;
    })}</ul>
  </div>;
}

// มุมมองปัจจุบันเป็นการ์ด บอกขั้นที่เรื่องไปถึงแล้ว เปิดการตอบกลับได้ทีละเรื่อง
function TicketCards({ onRead, onToggleReply, openReplyTicketId, readOnly, resource }: TicketListProps) {
  return <div className="grid gap-3">
    {resource.data.map((ticket) => <article aria-labelledby={`tenant-ticket-${ticket.id}`} className="panel grid gap-4" key={ticket.id}>
      <header className="flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className="chat-ticket-icon" data-tone={ticketStatusTone(ticket.status)}><TicketIcon type={ticket.type} /></span>
        {/* จอแคบให้ป้ายสถานะลงไปอยู่บรรทัดใหม่ ไม่ไปบีบหัวข้อจนเหลือคำละบรรทัด */}
        <div className="min-w-48 flex-1">
          <h2 className="break-words text-base font-semibold text-[#292a30]" id={`tenant-ticket-${ticket.id}`}>{ticket.title}</h2>
          <p className="text-sm text-[#62646c]">{ticketTypeLabel(ticket.type)} · แจ้ง {formatThaiDateTime(ticket.createdAt)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {ticket.hasUnreadReply ? <span className="badge bg-red-600 text-white">มีข้อความใหม่</span> : null}
          {/* ความเร่งด่วนปกติไม่ต้องบอก ป้ายจะได้ไม่รก บอกเฉพาะเรื่องที่ด่วน */}
          {ticket.priority === "URGENT" ? <span className="badge badge-overdue">{formatStatus(ticket.priority)}</span> : null}
          <Status kind="ticket" value={ticket.status} />
        </div>
      </header>
      <TicketSteps status={ticket.status} />
      <TicketBody
        onRead={onRead}
        readOnly={readOnly}
        showReplyThread={openReplyTicketId === ticket.id}
        ticket={ticket}
        toggleReply={() => onToggleReply(ticket.id)}
      />
    </article>)}
  </div>;
}

function TicketSteps({ status }: Readonly<{ status: string }>) {
  const progress = ticketProgress(status);
  if (progress.cancelled) return null;
  return <ol aria-label="ขั้นตอนของเรื่องนี้" className="tenant-steps">
    {progress.steps.map((step) => <li aria-current={step.state === "current" ? "step" : undefined} data-state={step.state} key={step.label}>
      <span aria-hidden="true" />
      {step.label}
    </li>)}
  </ol>;
}

// เรื่องแจ้งมีสองประเภท แจ้งซ่อมกับร้องเรียน

// คำบรรยายของเหตุการณ์หนึ่งบรรทัดในไทม์ไลน์ของเรื่องแจ้ง
function ticketEventLabel(event: Ticket["events"][number]) {
  if (event.type === "CREATED") return "สร้างรายการ";
  if (event.type === "STATUS_CHANGED") return `เปลี่ยนสถานะ ${formatTicketStatus(event.fromValue)} → ${formatTicketStatus(event.toValue)}`;
  if (event.type === "PRIORITY_CHANGED") return `เปลี่ยนความสำคัญ ${formatStatus(event.fromValue)} → ${formatStatus(event.toValue)}`;
  if (event.type === "REPLY_ADDED") return "มีข้อความตอบกลับ";
  return "แนบไฟล์";
}

// รายละเอียด ไฟล์แนบ ประวัติการดำเนินการ และการตอบกลับ ใช้ทั้งในการ์ดและในแถวประวัติ
function TicketBody({ onRead, readOnly, showReplyThread, ticket, toggleReply }: Readonly<{
  onRead: () => void;
  readOnly: boolean;
  showReplyThread: boolean;
  ticket: Ticket;
  toggleReply?: () => void;
}>) {
  return <div className="grid gap-3">
    <p className="whitespace-pre-wrap text-[#3f4048]">{ticket.detail}</p>
    {ticket.attachments.length ? <div className="flex flex-wrap gap-2">{ticket.attachments.map((file) => <a className="tenant-chip" href={`/api/v1/tenant/tickets/${ticket.id}/attachments/${file.id}`} key={file.id} rel="noreferrer" target="_blank"><Paperclip aria-hidden="true" size={13} />{file.fileName}</a>)}</div> : null}
    <details className="tenant-ticket-events">
      <summary>ประวัติการดำเนินการ ({ticket.events.length.toLocaleString("th-TH")})</summary>
      <ol className="mt-2 grid gap-1.5">{ticket.events.map((event) => <li className="text-sm text-[#62646c]" key={event.id}><time>{formatThaiDateTime(event.createdAt)}</time> · {ticketEventLabel(event)}</li>)}</ol>
    </details>
    {toggleReply ? <div><button className="secondary-button" onClick={toggleReply} type="button"><MessageSquare size={16} /> {showReplyThread ? "ปิดการตอบกลับ" : "เปิดการตอบกลับ"}</button></div> : null}
    {showReplyThread && !ticketAcceptsReplies(ticket.status, "TENANT") ? <p className="text-sm text-[#62646c]">{closedTicketNotice(ticket.status)}</p> : null}
    {showReplyThread ? <TicketReplyThread endpoint={`/api/v1/tenant/tickets/${ticket.id}/replies`} onRead={onRead} readOnly={readOnly || !ticketAcceptsReplies(ticket.status, "TENANT")} viewerRole="TENANT" /> : null}
  </div>;
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
    {/* ช่องแนบหน้าตาเดียวกับช่องแนบสลิป แทนปุ่มเลือกไฟล์ของเบราว์เซอร์ที่ขึ้นภาษาอังกฤษ "Choose File" */}
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-[#292a30]">แนบไฟล์ (ไม่บังคับ)</span>
      <label className="slip-picker">
        <input accept="image/png,image/jpeg,application/pdf,.pdf" className="sr-only" onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && next.size > 5 * 1024 * 1024) { setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB"); event.target.value = ""; setFile(null); return; } setError(""); setFile(next); }} type="file" />
        <span className="slip-picker-icon">{file ? <FileText aria-hidden="true" size={24} /> : <ImagePlus aria-hidden="true" size={24} />}</span>
        <span className="min-w-0">
          <strong className="block truncate">{file ? file.name : "แนบรูปหรือไฟล์ประกอบ"}</strong>
          <small className="block">{file ? "แตะเพื่อเปลี่ยนไฟล์" : "รูปภาพหรือ PDF ไม่เกิน 5 MB"}</small>
        </span>
      </label>
    </div>{error ? <p className="form-alert error" role="alert">{error}</p> : null}<footer className="modal-actions"><button onClick={onClose} type="button">ปิด</button><button className="primary-button" disabled={saving} type="submit">{ticketSubmitLabel(createdTicketId, saving)}</button></footer>
  </form></Dialog>;
}

type ChatMessage = { id: string; body: string; senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN"; senderName: string; createdAt: string; attachment: { name: string; mimeType: string; size: number; url: string } | null };
// หน้าต่างแชทเล็กของผู้เช่า หน้าแรกเป็นรายการ แชทกับหอปักไว้บนสุด ตามด้วยเรื่องที่ตัวเองแจ้งไว้
// กดเรื่องไหนก็คุยในเรื่องนั้นได้เลย ข้อความยังผูกกับเรื่องนั้นเหมือนคุยจากหน้าแจ้งเรื่อง
function TenantQuickChat({ initialView, onClose, onRead, propertyId, propertyName, readOnly, unreadMessages }: Readonly<{
  initialView: "list" | "chat";
  onClose: () => void;
  onRead: () => unknown;
  propertyId: string;
  propertyName: string;
  readOnly: boolean;
  unreadMessages: number;
}>) {
  const [view, setView] = useState<"list" | "chat" | "ticket">(initialView);
  const [tickets, setTickets] = useState<TicketInboxItem[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/tenant/ticket-inbox", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json() as { data?: TicketInboxItem[] };
      if (response.ok && payload.data) setTickets(payload.data);
    } catch {
      // โหลดเรื่องแจ้งไม่ได้ แชทกับหอยังใช้ได้ปกติ
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  // กลับมาที่รายการเมื่อไหร่ก็โหลดใหม่ จะได้เห็นคำตอบที่เพิ่งเข้ามา
  useEffect(() => {
    if (view === "list") void loadTickets();
  }, [loadTickets, view]);

  if (view === "chat") {
    return <TenantChat onBack={() => setView("list")} onClose={onClose} onRead={onRead} propertyId={propertyId} propertyName={propertyName} readOnly={readOnly} variant="widget" />;
  }

  const ticket = view === "ticket" ? tickets.find((item) => item.id === ticketId) : undefined;
  return <dialog aria-label="แชทกับหอพัก" className="chat-widget tenant-chat-widget" open>
    {ticket ? <>
      <header className="chat-widget-header chat-conversation-header">
        <IconButton label="ย้อนกลับไปยังรายการข้อความ" onClick={() => setView("list")}><ChevronLeft aria-hidden="true" size={20} /></IconButton>
        <div className="chat-conversation-brand">
          <span aria-hidden="true" className="chat-ticket-icon" data-size="sm" data-tone={ticketStatusTone(ticket.status)}><TicketIcon size={15} type={ticket.type} /></span>
          <span className="min-w-0">
            <strong className="block truncate">{ticket.title}</strong>
            <small className="block truncate">{ticketTypeLabel(ticket.type)} · <span className="chat-ticket-status" data-tone={ticketStatusTone(ticket.status)}>{formatTicketStatus(ticket.status)}</span></small>
          </span>
        </div>
        <div className="chat-header-actions">
          <IconButton label="ปิดช่องแชท" onClick={onClose}><X aria-hidden="true" size={20} /></IconButton>
        </div>
      </header>
      <TicketChatThread
        attachmentBase={`/api/v1/tenant/tickets/${ticket.id}/attachments`}
        endpoint={`/api/v1/tenant/tickets/${ticket.id}/replies`}
        key={ticket.id}
        onRead={onRead}
        readOnly={readOnly}
        ticket={ticket}
        viewer="TENANT"
      />
    </> : <>
      <header className="chat-widget-header">
        <div className="chat-widget-brand"><strong>ข้อความ</strong></div>
        <IconButton label="ปิดช่องแชท" onClick={onClose}><X aria-hidden="true" size={20} /></IconButton>
      </header>
      <div className="chat-widget-body">
        <div className="chat-tenant-list">
          <button className="chat-support-contact" data-unread={unreadMessages > 0 || undefined} onClick={() => setView("chat")} type="button">
            <span aria-hidden="true" className="chat-list-avatar support"><Building2 size={17} /></span>
            <span className="chat-contact-text">
              <span className="chat-contact-line"><strong>{propertyName}</strong><small>ปักหมุด</small></span>
              <span className="chat-contact-line">
                <small className="chat-contact-preview">ข้อความถึงผู้ดูแลหอพัก</small>
                {unreadMessages > 0 ? <span aria-label={`${unreadMessages} ข้อความที่ยังไม่ได้อ่าน`} className="chat-unread-badge">{unreadMessages > 99 ? "99+" : unreadMessages}</span> : null}
              </span>
            </span>
          </button>
          {isLoadingTickets ? <p className="chat-conversation-prompt py-6"><LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> กำลังโหลดเรื่องที่แจ้ง...</p> : null}
          {tickets.map((item) => <TicketInboxRow key={item.id} onOpen={(id) => { setTicketId(id); setView("ticket"); }} otherPrefix="หอ: " place="" ticket={item} />)}
        </div>
        {!readOnly ? <Link className="chat-new-ticket-link" href={tenantPagePath("tickets")} onClick={onClose}><Plus aria-hidden="true" size={15} /> แจ้งเรื่องใหม่</Link> : null}
      </div>
    </>}
  </dialog>;
}

// ปุ่มลัดในหน้าว่าง เรื่องที่ผู้เช่าทักหอบ่อยที่สุด กดแล้วเติมข้อความให้พิมพ์ต่อ
const tenantChatSuggestions = ["สอบถามเรื่องบิล", "แจ้งซ่อม", "สอบถามเรื่องพัสดุ"];

function TenantChat({
  onBack,
  onClose,
  onRead,
  propertyId,
  propertyName,
  readOnly,
  variant = "page",
}: Readonly<{
  // หน้าต่างแชทเล็กมีรายการข้อความก่อน ปุ่มนี้พากลับไปที่รายการ
  onBack?: () => void;
  onClose?: () => void;
  // เปิดอ่านแล้วให้เปลือกโหลดตัวเลขบนป้ายแชทและกระดิ่งใหม่
  onRead?: () => unknown;
  propertyId: string;
  propertyName: string;
  readOnly: boolean;
  variant?: "page" | "widget";
}>) {
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    attachment, endRef, error, fileInputRef, hasOlderMessages, isLoading, isLoadingOlder,
    isReady, isSending, loadOlderMessages, message, messages, scrollRef, sendMessage,
    setAttachment, setError, setMessage,
  } = useChatThread<ChatMessage>({
    endpoint: "/api/v1/tenant/chat",
    onRead,
    propertyId,
    requireConversationId: true,
    streaming: true,
  });

  const messageList = <ChatMessageList
    className={variant === "widget" ? "chat-conversation tenant-quick-chat-messages" : "chat-conversation tenant-chat-message-list"}
    emptyState={<ChatEmptyState
      description={readOnly ? "ประวัติข้อความกับหอพักจะแสดงที่นี่" : "เลือกเรื่องด้านล่าง หรือพิมพ์เองได้เลย"}
      onSuggest={readOnly ? undefined : (text) => { setMessage(text); composerInputRef.current?.focus(); }}
      suggestions={tenantChatSuggestions}
      title="เริ่มคุยกับหอพัก"
    />}
    endRef={endRef}
    hasOlderMessages={hasOlderMessages}
    isLoading={isLoading}
    isLoadingOlder={isLoadingOlder}
    messages={messages}
    onLoadOlder={() => void loadOlderMessages()}
    ownRole="TENANT"
    scrollRef={scrollRef}
  />;

  // โหมดอ่านอย่างเดียวแสดงป้ายแทนช่องพิมพ์
  const composer = readOnly
    ? <div className="p-3"><ReadOnlyNotice>อ่านประวัติข้อความได้ แต่ไม่สามารถส่งข้อความใหม่ได้</ReadOnlyNotice></div>
    : <ChatComposer
      attachment={attachment}
      error=""
      fileInputRef={fileInputRef}
      inputLabel="ข้อความถึงหอพัก"
      inputRef={composerInputRef}
      isReady={isReady}
      isSending={isSending}
      message={message}
      onSubmit={sendMessage}
      setAttachment={setAttachment}
      setError={setError}
      setMessage={setMessage}
    />;

  if (variant === "widget") {
    // dialog แบบเปิดค้างไม่บังหน้า (non-modal) ผู้เช่ายังใช้หน้าข้างหลังได้ระหว่างแชท
    return <dialog aria-label="แชทกับหอพัก" className={`chat-widget tenant-chat-widget${isExpanded ? " expanded" : ""}`} open>
      <header className="chat-widget-header">
        {onBack ? <IconButton label="ย้อนกลับไปยังรายการข้อความ" onClick={onBack}><ChevronLeft aria-hidden="true" size={20} /></IconButton> : null}
        <div className="chat-conversation-brand">
          <span aria-hidden="true" className="chat-list-avatar support" data-size="sm"><Building2 size={15} /></span>
          <span className="min-w-0">
            <strong className="block truncate">{propertyName}</strong>
            <small className="block truncate">ข้อความถึงผู้ดูแลหอพัก</small>
          </span>
        </div>
        <div className="chat-header-actions">
          <WindowSizeButton isExpanded={isExpanded} onToggle={() => setIsExpanded((current) => !current)} />
          <IconButton label="ปิดช่องแชท" onClick={onClose}><X aria-hidden="true" size={20} /></IconButton>
        </div>
      </header>
      {error ? <p className="chat-error mx-3 mt-3" role="alert">{error}</p> : null}
      {messageList}
      {composer}
    </dialog>;
  }

  return <div className="grid gap-5">
    <Panel title="ข้อความ">
      {error ? <p className="form-alert error" role="alert">{error}</p> : null}
      {messageList}
      {composer}
    </Panel>
  </div>;
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
