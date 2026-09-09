"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Tenant Portal” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Image from "next/image";
import Link from "next/link";
import { IconButton } from "@/components/ui/IconButton";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { useRouter } from "next/navigation";
import { FormEvent, Fragment, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Clock3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Expand,
  FileText,
  Home,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  MoreHorizontal,
  Package,
  Paperclip,
  QrCode,
  ReceiptText,
  Send,
  Shrink,
  Upload,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { TicketReplyThread } from "@/components/dorm/TicketReplyThread";
import { DropdownField } from "@/components/dorm/DropdownField";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { LoadMoreButton, RetryButton } from "@/components/ui/DataNavigation";
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
import { tenantPagePath, type TenantTab } from "@/lib/navigation-routes";
import { blocksSubscriptionMutations, resolveSubscriptionUiAccessState } from "@/lib/client/subscription-access-state";
import type { TenantRecordView } from "@/lib/tenant-record-view";
import { PrivacyPreferencesPanel } from "@/components/legal/PrivacyPreferencesPanel";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Account” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Account = {
  id: string;
  phone: string;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  user: { displayName: string; email: string };
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
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Room Data” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Tenant Notification Summary” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type TenantNotificationSummary = {
  unpaidInvoices: number;
  waitingParcels: number;
  openTickets: number;
  unreadMessages: number;
  unreadTicketReplies: number;
  subscriptionAccess: {
    mode: "FULL" | "GRACE" | "READ_ONLY";
    isReadOnly: boolean;
    graceEndsAt: string | null;
  };
};

/** สีประจำหมวดของไอคอนเมนู (ดู .sidebar nav [data-accent] ใน globals.css) ให้
 * ตรงชุดเดียวกับฝั่งแอดมิน: บิล/ชำระเงิน = เขียว, แจ้งเรื่อง/ซ่อม = magenta,
 * พัสดุ = cyan ใช้เฉพาะเมนูเดสก์ท็อป (.sidebar) ส่วน bottom nav บนมือถือคง
 * ไอคอนสีเดียวไว้ตามเดิมเพื่อความเรียบร้อยของแถบเล็ก ๆ */
const tabs: Array<{ accent?: "green" | "magenta" | "cyan"; id: TenantTab; label: string; icon: typeof Home }> = [
  { id: "home", label: "หน้าหลัก", icon: Home },
  { accent: "green", id: "invoices", label: "บิลและชำระเงิน", icon: ReceiptText },
  { id: "lease", label: "สัญญา", icon: FileText },
  { id: "announcements", label: "ประกาศ", icon: Bell },
  { accent: "cyan", id: "parcels", label: "พัสดุ", icon: Package },
  { accent: "magenta", id: "tickets", label: "แจ้งเรื่อง", icon: Wrench },
  { id: "chat", label: "ติดต่อหอ", icon: MessageSquare },
  { id: "account", label: "บัญชีของฉัน", icon: UserRound },
];

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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “mobile Primary Tabs” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - { id }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const mobilePrimaryTabs = tabs.filter(({ id }) => ["home", "invoices", "parcels", "tickets"].includes(id));
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “navigation Tabs” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - { id }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const navigationTabs = tabs.filter(({ id }) => !["chat", "account"].includes(id));
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “mobile More Tabs” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - { id }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const mobileMoreTabs = tabs.filter(({ id }) => ["lease", "announcements", "account"].includes(id));

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “api Data” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
async function apiData<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: React hook “use Api Resource” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ
 * รับค่า:
 * - url: ค่า “url” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - enabled: ค่า “enabled” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function useApiResource<T>(url: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(enabled);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - signal: ค่า “signal” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return { data, error, isLoading, reload: load };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Paginated Resource” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: React hook “use Paginated Resource” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ
 * รับค่า:
 * - url: ค่า “url” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - pageSize: ค่า “page Size” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด PaginatedResource<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
function usePaginatedResource<T>(url: string, pageSize = 20): PaginatedResource<T> {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “request Page” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - replace: ค่า “replace” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - signal: สัญญาณยกเลิก ใช้ตอน component ถูก unmount หรือ url เปลี่ยน
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const requestPage = useCallback(async (targetPage: number, replace: boolean, signal?: AbortSignal) => {
    if (replace) setIsLoading(true);
    else setIsLoadingMore(true);
    setError("");
    try {
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “reload” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const reload = useCallback(() => requestPage(1, true), [requestPage]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load More” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const loadMore = useCallback(() => requestPage(page + 1, false), [page, requestPage]);
  useEffect(() => {
    const controller = new AbortController();
    void requestPage(1, true, controller.signal);
    return () => controller.abort();
  }, [requestPage]);
  return { data, error, hasNextPage, isLoading, isLoadingMore, loadMore, reload, total };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant Portal” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { activeTab, initialAccount, initialSelectedOccupancyId, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function TenantPortal({
  activeTab,
  initialAccount,
  initialSelectedOccupancyId,
}: {
  activeTab: TenantTab;
  initialAccount: Account;
  initialSelectedOccupancyId: string | null;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount);
  const [selectedOccupancyId, setSelectedOccupancyId] = useState(initialSelectedOccupancyId);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isQuickChatOpen, setIsQuickChatOpen] = useState(false);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “active” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const active = account.occupancies.find((item) => item.id === selectedOccupancyId && item.status === "ACTIVE");
  const roomResource = useApiResource<RoomData>("/api/v1/tenant/room", Boolean(active));
  const notificationResource = useApiResource<TenantNotificationSummary>(
    "/api/v1/tenant/notifications/summary",
    Boolean(active),
  );
  const primary = active?.role === "PRIMARY";
  const accessState = resolveSubscriptionUiAccessState({
    accessMode: notificationResource.data?.subscriptionAccess.mode,
    enabled: Boolean(active),
    error: notificationResource.error,
    isLoading: notificationResource.isLoading,
  });
  const isReadOnly = blocksSubscriptionMutations(accessState);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “notification Count” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - tab: ค่า “tab” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const notificationCount = (tab: TenantTab) => {
    const summary = notificationResource.data;
    if (!summary) return 0;
    if (tab === "invoices") return summary.unpaidInvoices;
    if (tab === "parcels") return summary.waitingParcels;
    if (tab === "tickets") return summary.unreadTicketReplies || summary.openTickets;
    if (tab === "chat") return summary.unreadMessages;
    if (tab === "home") {
      return summary.unpaidInvoices + summary.waitingParcels + summary.openTickets + summary.unreadMessages + summary.unreadTicketReplies;
    }
    return 0;
  };
  const tenantNotifications: NotificationCenterItem[] = notificationResource.data ? [
    { id: "unpaid-invoices", count: notificationResource.data.unpaidInvoices, title: "บิลที่รอชำระ", description: "ตรวจสอบยอดและกำหนดชำระของบิลล่าสุด", href: tenantPagePath("invoices"), icon: <ReceiptText size={19} /> },
    { id: "waiting-parcels", count: notificationResource.data.waitingParcels, title: "มีพัสดุรอรับ", description: "ติดต่อหอพักเพื่อรับพัสดุของคุณ", href: tenantPagePath("parcels"), icon: <Package size={19} /> },
    { id: "open-tickets", count: notificationResource.data.openTickets, title: "เรื่องแจ้งที่กำลังดำเนินการ", description: "ติดตามสถานะงานซ่อมหรือเรื่องร้องเรียน", href: tenantPagePath("tickets"), icon: <Wrench size={19} /> },
    { id: "ticket-replies", count: notificationResource.data.unreadTicketReplies, title: "มีคำตอบใหม่ในเรื่องแจ้ง", description: "เปิดอ่านคำตอบล่าสุดจากผู้ดูแลหอ", href: tenantPagePath("tickets"), icon: <MessageSquare size={19} /> },
    { id: "messages", count: notificationResource.data.unreadMessages, title: "ข้อความใหม่จากหอพัก", description: "เปิดอ่านข้อความจากผู้ดูแลหอ", href: tenantPagePath("chat"), icon: <MessageSquare size={19} /> },
  ] : [];
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “switch Occupancy” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - occupancyId: รหัสภายในของ occupancy
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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
      await Promise.all([roomResource.reload(), notificationResource.reload()]);
      router.push(tenantPagePath("home"));
      router.refresh();
    } finally {
      setIsSwitching(false);
    }
  };
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “refresh Account” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const refreshAccount = async () => {
    const updated = await apiData<Account>(await fetch("/api/v1/tenant/me", {
      cache: "no-store",
      credentials: "same-origin",
    }));
    setAccount(updated);
  };

  const activeTabItem = tabs.find(({ id }) => id === activeTab) ?? tabs[0];

  return <main className="tenant-portal tenant-shell shell text-[#292a30]">
    <LiveAnnouncement message={`เปิดหน้า ${tabs.find(({ id }) => id === activeTab)?.label ?? "พื้นที่ผู้เช่า"}`} />
    <aside className="sidebar tenant-sidebar">
      <div className="brand tenant-brand">
        <PlatformBrand className="[&_small]:text-[#73757d] [&_strong]:text-base" context="Tenant" imageClassName="size-11" showTagline />
      </div>
      <p className="tenant-sidebar-property">{active?.property.name ?? "พื้นที่ผู้เช่า"}</p>
      <nav aria-label="เมนูผู้เช่า">
        {navigationTabs.map(({ accent, id, icon: Icon, label }) => (
          <Link aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "active" : ""} data-accent={accent} href={tenantPagePath(id)} key={id}>
            <Icon size={19} />{label}
            {notificationCount(id) > 0 ? (
              <span className="notification-badge" aria-label={`${notificationCount(id)} รายการที่ต้องตรวจสอบ`}>
                {notificationCount(id) > 99 ? "99+" : notificationCount(id)}
              </span>
            ) : null}
          </Link>
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
          {active ? <NotificationCenter isLoading={notificationResource.isLoading} items={tenantNotifications} onRefresh={notificationResource.reload} readOnly={accessState === "read-only"} storageKey={`tenant-notifications:${active.id}`} /> : null}
          {account.occupancies.filter(({ status }) => status === "ACTIVE").length > 0 ? <DropdownField
            disabled={isSwitching}
            label="เลือกการเข้าพัก"
            onChange={(value) => void switchOccupancy(value)}
            options={account.occupancies.filter(({ status }) => status === "ACTIVE").map((occupancy) => ({ label: `${occupancy.property.shortName} · ห้อง ${occupancy.room.number}`, value: occupancy.id }))}
            value={active?.id ?? ""}
          /> : null}
        </div>
      </header>
    {accessState === "loading" ? <div className="subscription-access-banner grace mx-auto mt-5 max-w-[1400px]" role="status">
      <span><LoaderCircle className="animate-spin" aria-hidden="true" /></span>
      <div>
        <strong>กำลังตรวจสอบสิทธิ์การใช้งาน</strong>
        <p>ระบบปิดการส่งข้อมูลใหม่ไว้ชั่วคราวระหว่างตรวจสอบสถานะแพ็กเกจ</p>
      </div>
    </div> : accessState === "error" ? <div className="subscription-access-banner grace mx-auto mt-5 max-w-[1400px]" role="alert">
      <span><AlertCircle aria-hidden="true" /></span>
      <div>
        <strong>ยังตรวจสอบสิทธิ์การใช้งานไม่ได้</strong>
        <p>ระบบปิดการส่งข้อมูลใหม่ไว้ชั่วคราว กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p>
      </div>
      <button className="primary-button" onClick={() => void notificationResource.reload()} type="button">ลองตรวจสอบใหม่</button>
    </div> : accessState === "read-only" ? <div className="subscription-access-banner read-only mx-auto mt-5 max-w-[1400px]" role="alert">
      <span><AlertCircle aria-hidden="true" /></span>
      <div>
        <strong>หอพักนี้อยู่ในโหมดอ่านอย่างเดียว</strong>
        <p>คุณยังดูห้อง บิล สัญญา ประกาศ พัสดุ และประวัติเดิมได้ แต่ยังส่งสลิป แจ้งเรื่อง หรือส่งข้อความใหม่ไม่ได้</p>
      </div>
    </div> : null}
    <div className="tenant-content mx-auto max-w-[1500px] px-6 py-6">
      <section className="view-transition min-w-0" key={activeTab}>
        {activeTab === "account" ? (
          <AccountPanel account={account} onUpdated={setAccount} refreshAccount={refreshAccount} />
        ) : !active ? <PendingState account={account} /> : <>
          {activeTab === "home" ? (
            <HomePanel
              account={account}
              isPrimary={primary}
              notificationResource={notificationResource}
              roomResource={roomResource}
            />
          ) : null}
          {activeTab === "invoices" ? primary ? <InvoicesPanel readOnly={isReadOnly} /> : <RestrictedPanel message="เฉพาะผู้เช่าหลักเท่านั้นที่ดูและชำระบิลได้" /> : null}
          {activeTab === "lease" ? primary ? <LeasePanel /> : <RestrictedPanel message="เฉพาะผู้เช่าหลักเท่านั้นที่ดูสัญญาได้" /> : null}
          {activeTab === "announcements" ? <AnnouncementsPanel /> : null}
          {activeTab === "parcels" ? <ParcelsPanel /> : null}
          {activeTab === "tickets" ? <TicketsPanel onUnreadChanged={notificationResource.reload} readOnly={isReadOnly} /> : null}
          {activeTab === "chat" ? roomResource.isLoading ? <Loading /> : roomResource.error || !roomResource.data
            ? <ErrorState error={roomResource.error} retry={() => void roomResource.reload()} />
            : <TenantChat propertyId={roomResource.data.room.property.id} readOnly={isReadOnly} /> : null}
        </>}
      </section>
    </div>
    </section>
    <nav aria-label="เมนูผู้เช่าบนมือถือ" className="tenant-mobile-navigation">
      {mobilePrimaryTabs.map(({ id, icon: Icon, label }) => (
        <Link aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "active" : ""} href={tenantPagePath(id)} key={id}>
          <span className="tenant-mobile-nav-icon">
            <Icon aria-hidden="true" size={21} />
            {notificationCount(id) > 0 ? <span className="tenant-mobile-nav-badge">{notificationCount(id) > 99 ? "99+" : notificationCount(id)}</span> : null}
          </span>
          <span>{id === "invoices" ? "บิล" : id === "tickets" ? "แจ้งเรื่อง" : label}</span>
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
  </main>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Account Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { account, onUpdated, refreshAccount, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function AccountPanel({
  account,
  onUpdated,
  refreshAccount,
}: {
  account: Account;
  onUpdated: (account: Account) => void;
  refreshAccount: () => Promise<void>;
}) {
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Profile” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const saveProfile = async (event: FormEvent) => {
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “change Password” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const changePassword = async (event: FormEvent) => {
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
        {profileMessage ? <p className="account-settings-message success" role="status">{profileMessage}</p> : null}
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
            <p className="text-sm text-[#73757d]">
              {occupancy.role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}
              {occupancy.startedAt ? ` · เริ่ม ${new Date(occupancy.startedAt).toLocaleDateString("th-TH")}` : ""}
              {occupancy.endedAt ? ` · สิ้นสุด ${new Date(occupancy.endedAt).toLocaleDateString("th-TH")}` : ""}
            </p>
          </div>
          <span className="badge">{occupancyLabels[occupancy.status]}</span>
        </article>) : <Empty icon={<Home />} text="ยังไม่มีข้อมูลการเข้าพัก" />}
        </div>
        <div className="mt-5 border-t border-[#e3e4e8] pt-5">
        <AcceptInvitationForm onAccepted={refreshAccount} />
        </div>
      </section>
      <PrivacyPreferencesPanel />
    </div>

    {isEditingProfile ? <Dialog ariaDescribedBy="tenant-profile-description" ariaLabelledBy="tenant-profile-title" onClose={() => { if (!isSavingProfile) setIsEditingProfile(false); }}>
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

    {isEditingPassword ? <Dialog ariaDescribedBy="tenant-password-description" ariaLabelledBy="tenant-password-title" onClose={() => { if (!isSavingPassword) setIsEditingPassword(false); }}>
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Accept Invitation Form” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { onAccepted }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function AcceptInvitationForm({ onAccepted }: { onAccepted: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submit = async (event: FormEvent) => {
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
    {message ? <small className="text-emerald-700" role="status">{message}</small> : null}
    {error ? <small className="text-red-600" role="alert">{error}</small> : null}
  </form>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Pending State” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { account }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function PendingState({ account }: { account: Account }) {
  const latest = account.occupancies[0];
  return <Panel title="สถานะการเข้าพัก"><div className="empty-state"><Clock3 size={40} /><strong>{latest?.status === "PENDING" ? "รอเจ้าของหออนุมัติ" : "ยังไม่มีการเข้าพักที่ใช้งาน"}</strong><p>เมื่อได้รับอนุมัติแล้ว คุณจะเข้าถึงข้อมูลห้องและบริการของหอได้</p></div></Panel>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Home Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { account, isPrimary, notificationResource, roomResource, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function HomePanel({
  account,
  isPrimary,
  notificationResource,
  roomResource,
}: {
  account: Account;
  isPrimary: boolean;
  notificationResource: ReturnType<typeof useApiResource<TenantNotificationSummary>>;
  roomResource: ReturnType<typeof useApiResource<RoomData>>;
}) {
  const invoices = useApiResource<Invoice[]>("/api/v1/tenant/invoices?page=1&pageSize=5", isPrimary);
  const parcels = useApiResource<Parcel[]>("/api/v1/tenant/parcels?page=1&pageSize=5");
  const tickets = useApiResource<Ticket[]>("/api/v1/tenant/tickets?page=1&pageSize=5");
  const heroRef = useRef<HTMLElement>(null);
  const heroCopyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (roomResource.isLoading || !heroRef.current || !heroCopyRef.current) return;
    const hero = heroRef.current;
    const copy = heroCopyRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Hero” โดยใช้ค่าที่รับเข้ามา
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const updateHero = () => {
      animationFrame = 0;
      const bounds = hero.getBoundingClientRect();
      const heroTop = bounds.top + window.scrollY;
      const fadeStart = Math.max(0, heroTop - 96);
      const fadeDistance = Math.max(180, bounds.height * 0.7);
      const progress = reduceMotion.matches
        ? 0
        : Math.min(1, Math.max(0, (window.scrollY - fadeStart) / fadeDistance));
      copy.style.setProperty("--tenant-hero-progress", progress.toFixed(3));
      hero.style.setProperty("--tenant-hero-progress", progress.toFixed(3));
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “request Update” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const requestUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateHero);
    };

    updateHero();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reduceMotion.addEventListener("change", requestUpdate);
    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reduceMotion.removeEventListener("change", requestUpdate);
    };
  }, [roomResource.isLoading]);

  if (roomResource.isLoading) return <Loading />;
  if (roomResource.error || !roomResource.data) {
    return <ErrorState error={roomResource.error} retry={() => void roomResource.reload()} />;
  }

  const { room, role, startedAt } = roomResource.data;
  const furniture = Array.isArray(room.furniture) ? room.furniture.filter((item): item is string => typeof item === "string") : [];
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “unpaid Invoice” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - invoice: ค่า “invoice” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const unpaidInvoice = invoices.data?.find((invoice) => ["PENDING", "OVERDUE"].includes(invoice.status));
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “waiting Parcel” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - parcel: ค่า “parcel” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const waitingParcel = parcels.data?.find((parcel) => parcel.status === "WAITING");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Ticket” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - ticket: ค่า “ticket” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const openTicket = tickets.data?.find((ticket) => !["RESOLVED", "CANCELLED"].includes(ticket.status));
  const summary = notificationResource.data;
  const hasOverviewError = notificationResource.error || invoices.error || parcels.error || tickets.error;

  return <div className="tenant-home">
    <section className="tenant-home-hero" ref={heroRef}>
      <div className="tenant-home-hero-copy" ref={heroCopyRef}>
        <p className="tenant-home-eyebrow">{room.property.name}</p>
        <h1>
          <span className="tenant-home-title-line">สวัสดี</span>
          <span className="tenant-home-title-line tenant-home-title-line-secondary">{account.user.displayName}</span>
        </h1>
        <p className="tenant-home-room">ห้อง {room.number} · {room.building.name} · {room.floor.label ?? `ชั้น ${room.floor.number}`} · {role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}</p>
      </div>
    </section>

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

    <section aria-labelledby="tenant-priority-heading">
      <div className="mb-3">
        <h2 className="text-2xl font-black" id="tenant-priority-heading">ภาพรวมที่ต้องรู้</h2>
        <p className="text-sm text-[#73757d]">บิล พัสดุ และเรื่องที่กำลังติดตาม</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <HomePriorityCard
          accent="border-amber-200 bg-amber-50"
          detail={isPrimary
            ? unpaidInvoice
              ? `ครบกำหนด ${new Date(unpaidInvoice.dueDate).toLocaleDateString("th-TH")}`
              : "ไม่มีบิลที่ต้องชำระ"
            : "ผู้พักร่วมไม่ต้องดำเนินการ"}
          href={tenantPagePath("invoices")}
          icon={<ReceiptText />}
          label="ยอดที่ต้องชำระ"
          value={isPrimary ? unpaidInvoice ? currency.format(Number(unpaidInvoice.total)) : "ไม่มี" : "-"}
        />
        <HomePriorityCard
          accent="border-sky-200 bg-sky-50"
          detail={waitingParcel
            ? `${waitingParcel.note || "พัสดุใหม่"} · ${new Date(waitingParcel.registeredAt).toLocaleDateString("th-TH")}`
            : "ไม่มีพัสดุรอรับ"}
          href={tenantPagePath("parcels")}
          icon={<Package />}
          label="พัสดุรอรับ"
          value={`${summary?.waitingParcels ?? 0} รายการ`}
        />
        <HomePriorityCard
          accent="border-violet-200 bg-violet-50"
          detail={openTicket ? openTicket.title : "ไม่มีเรื่องที่กำลังดำเนินการ"}
          href={tenantPagePath("tickets")}
          icon={<Wrench />}
          label="เรื่องที่กำลังติดตาม"
          value={`${summary?.openTickets ?? 0} รายการ`}
        />
      </div>
    </section>

    <Panel title="งานที่ต้องทำ">
      <div className="grid gap-3">
        {isPrimary && unpaidInvoice ? (
          <HomeTask
            detail={`บิล ${unpaidInvoice.invoiceNumber} ครบกำหนด ${new Date(unpaidInvoice.dueDate).toLocaleDateString("th-TH")}`}
            href={tenantPagePath("invoices")}
            label={unpaidInvoice.status === "OVERDUE" ? "บิลเกินกำหนดชำระ" : "ชำระบิลรอบล่าสุด"}
            tone={unpaidInvoice.status === "OVERDUE" ? "text-red-600" : "text-amber-600"}
          />
        ) : null}
        {(summary?.waitingParcels ?? 0) > 0 ? (
          <HomeTask detail={`มีพัสดุรอรับ ${summary?.waitingParcels ?? 0} รายการ`} href={tenantPagePath("parcels")} label="รับพัสดุที่หอพัก" tone="text-sky-600" />
        ) : null}
        {(summary?.openTickets ?? 0) > 0 ? (
          <HomeTask detail={openTicket ? `รายการล่าสุด: ${openTicket.title}` : `${summary?.openTickets ?? 0} รายการกำลังดำเนินการ`} href={tenantPagePath("tickets")} label="ติดตามเรื่องที่แจ้งไว้" tone="text-violet-600" />
        ) : null}
        {(summary?.unreadMessages ?? 0) > 0 ? (
          <HomeTask detail={`มีข้อความที่ยังไม่ได้อ่าน ${summary?.unreadMessages ?? 0} ข้อความ`} href={tenantPagePath("chat")} label="อ่านข้อความจากหอพัก" tone="text-emerald-600" />
        ) : null}
        {(!isPrimary || !unpaidInvoice)
          && (summary?.waitingParcels ?? 0) === 0
          && (summary?.openTickets ?? 0) === 0
          && (summary?.unreadMessages ?? 0) === 0
          && !notificationResource.isLoading ? (
            <div className="empty-state min-h-36">
              <Clock3 size={32} />
              <strong>ไม่มีรายการที่ต้องดำเนินการ</strong>
              <p>เมื่อมีบิล พัสดุ หรือการอัปเดต ระบบจะแสดงที่นี่</p>
            </div>
          ) : null}
        {notificationResource.isLoading ? <Loading /> : null}
      </div>
    </Panel>

    <div className="grid gap-4 sm:grid-cols-3">
      <InfoCard label="ค่าเช่าต่อเดือน" value={currency.format(Number(room.monthlyRent))} />
      <InfoCard label="ประเภทห้อง" value={room.roomType} />
      <InfoCard label="เริ่มเข้าพัก" value={startedAt ? new Date(startedAt).toLocaleDateString("th-TH") : "-"} />
    </div>

    <details className="panel group">
      <summary className="cursor-pointer list-none text-lg font-black">ข้อมูลห้องและช่องทางติดต่อ</summary>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Info label="ที่อยู่" value={room.property.settings?.address ?? "-"} />
        <Info label="โทรศัพท์" value={room.property.settings?.contactPhone ?? "-"} />
        <Info label="อีเมล" value={room.property.settings?.contactEmail ?? "-"} />
        <Info label="ติดต่อฉุกเฉิน" value={room.property.settings?.emergencyContact ?? "-"} />
        <Info label="อุปกรณ์ในห้อง" value={furniture.join(", ") || "-"} />
        <Info label="เบอร์ผู้เช่า" value={account.phone} />
      </dl>
      {room.property.settings?.houseRules ? <div className="mt-5 rounded-2xl bg-brand/[.06] p-4"><strong>กฎของหอพัก</strong><p className="mt-2 whitespace-pre-wrap">{room.property.settings.houseRules}</p></div> : null}
    </details>
    </div>
  </div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Home Priority Card” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { accent, detail, href, icon, label, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function HomePriorityCard({ accent, detail, href, icon, label, value }: {
  accent: string;
  detail: string;
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return <Link className={`rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${accent}`} href={href}>
    <div className="flex items-start justify-between gap-3">
      <span className="grid size-11 place-items-center rounded-2xl bg-white text-brand shadow-sm">{icon}</span>
      <ArrowRight size={19} />
    </div>
    <p className="mt-5 text-sm font-bold text-[#73757d]">{label}</p>
    <strong className="mt-1 block text-2xl font-black">{value}</strong>
    <small className="mt-2 block text-[#73757d]">{detail}</small>
  </Link>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Home Task” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { detail, href, label, tone }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function HomeTask({ detail, href, label, tone }: {
  detail: string;
  href: string;
  label: string;
  tone: string;
}) {
  return <Link className="flex items-center gap-4 rounded-2xl border border-[#e3e4e8] p-4 transition hover:border-brand hover:bg-brand/[.03]" href={href}>
    <AlertCircle className={tone} size={23} />
    <span className="min-w-0 flex-1">
      <strong className="block">{label}</strong>
      <small className="block truncate text-[#73757d]">{detail}</small>
    </span>
    <ArrowRight className="shrink-0 text-[#73757d]" size={18} />
  </Link>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Invoice” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Invoice = { id: string; invoiceNumber: string; billingMonth: string; status: string; dueDate: string; total: string; paidAt: string | null; cancelledAt: string | null };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Invoice Detail” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type InvoiceDetail = Invoice & { subtotal: string; lateFee: string; room: { number: string }; items: Array<{ id: string; description: string; quantity: string; unitPrice: string; amount: string }> };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Submission” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Submission = { id: string; amount: string; status: string; submittedAt: string; reviewedAt: string | null; rejectionNote: string | null };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant History Tabs” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { currentLabel, historyLabel, id, onChange, view, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TenantHistoryTabs({
  currentLabel,
  historyLabel,
  id,
  onChange,
  view,
}: {
  currentLabel: string;
  historyLabel: string;
  id: string;
  onChange: (view: TenantRecordView) => void;
  view: TenantRecordView;
}) {
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant History Table” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, title, total }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TenantHistoryTable({ children, title, total }: { children: ReactNode; title: string; total: number | null }) {
  return <section className="figma-table-card">
    <header className="additional-card-head">
      <div><h2>{title}</h2><p>{total === null ? "กำลังนับรายการ..." : `ทั้งหมด ${total.toLocaleString("th-TH")} รายการ`}</p></div>
    </header>
    <div className="overflow-x-auto">{children}</div>
  </section>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Invoices Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { readOnly }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function InvoicesPanel({ readOnly }: { readOnly: boolean }) {
  const [view, setView] = useState<TenantRecordView>("current");
  const currentResource = usePaginatedResource<Invoice>("/api/v1/tenant/invoices?view=current");
  const historyResource = usePaginatedResource<Invoice>("/api/v1/tenant/invoices?view=history");
  const reloadCurrentInvoices = currentResource.reload;
  const reloadInvoiceHistory = historyResource.reload;
  const resource = view === "current" ? currentResource : historyResource;
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “change View” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - nextView: ค่า “next View” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const changeView = (nextView: TenantRecordView) => {
    setExpandedInvoiceId(null);
    setView(nextView);
  };
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “reload Invoices” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const reloadInvoices = useCallback(async () => {
    await Promise.all([reloadCurrentInvoices(), reloadInvoiceHistory()]);
  }, [reloadCurrentInvoices, reloadInvoiceHistory]);
  return <div className="grid gap-5">
    <TenantHistoryTabs currentLabel="บิลปัจจุบัน" historyLabel="ประวัติบิล" id="tenant-invoices" onChange={changeView} view={view} />
    <div aria-labelledby={`tenant-invoices-tab-${view}`} aria-live="polite" id="tenant-invoices-panel" role="tabpanel" tabIndex={0}>
    {resource.isLoading ? <Loading /> : resource.error && !resource.data.length ? <ErrorState error={resource.error} retry={() => void resource.reload()} /> : resource.data.length === 0 ? <Empty icon={<ReceiptText />} text={view === "current" ? "ไม่มีบิลที่ต้องดำเนินการ" : "ยังไม่มีประวัติบิล"} /> : view === "history" ? <TenantHistoryTable title="ประวัติบิล" total={historyResource.total}>
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
              <td><button aria-controls={panelId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียดบิล ${invoice.invoiceNumber}`} className="grid size-10 place-items-center rounded-xl bg-[#f1f1f3] text-[#555761]" onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)} type="button"><ChevronDown aria-hidden="true" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={20} /></button></td>
            </tr>
            {isExpanded ? <tr><td className="p-0!" colSpan={6}><InvoiceDetails id={panelId} invoice={invoice} onChanged={reloadInvoices} readOnly={readOnly} /></td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table>
    </TenantHistoryTable> : <div className="grid gap-3">
      {resource.data.map((invoice) => {
        const isExpanded = expandedInvoiceId === invoice.id;
        const panelId = `tenant-invoice-details-${invoice.id}`;
        return <article className={`panel overflow-hidden p-0 transition ${isExpanded ? "border-brand" : ""}`} key={invoice.id}>
          <button aria-controls={panelId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียดบิล ${invoice.invoiceNumber} ยอด ${currency.format(Number(invoice.total))} สถานะ ${formatStatus(invoice.status)}`} className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-brand/[.03]" onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)} type="button">
            <span><strong className="block text-lg">{invoice.invoiceNumber}</strong><small>{new Date(invoice.billingMonth).toLocaleDateString("th-TH", { month: "long", year: "numeric" })} · ครบกำหนด {new Date(invoice.dueDate).toLocaleDateString("th-TH")}</small></span>
            <span className="flex shrink-0 items-center gap-4 text-right">
              <span><strong className="block text-xl">{currency.format(Number(invoice.total))}</strong><Status value={invoice.status} /></span>
              <span className="grid size-10 place-items-center rounded-xl bg-[#f1f1f3] text-[#555761]" title={isExpanded ? "ยุบรายละเอียด" : "ขยายรายละเอียด"}><ChevronDown aria-hidden="true" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={20} /></span>
            </span>
          </button>
          {isExpanded ? <InvoiceDetails id={panelId} invoice={invoice} onChanged={reloadInvoices} readOnly={readOnly} /> : null}
        </article>;
      })}
    </div>}
    {!resource.isLoading && !resource.error ? <PaginationActions resource={resource} /> : null}
    </div>
  </div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Invoice Details” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { id, invoice, onChanged, readOnly }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function InvoiceDetails({ id, invoice, onChanged, readOnly }: { id: string; invoice: Invoice; onChanged: () => Promise<void>; readOnly: boolean }) {
  const detail = useApiResource<InvoiceDetail>(`/api/v1/tenant/invoices/${invoice.id}`);
  const submissions = useApiResource<Submission[]>(`/api/v1/tenant/invoices/${invoice.id}/payment-submissions`);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const payable = ["PENDING", "OVERDUE"].includes(invoice.status);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submit = async () => {
    if (!file) return;
    setIsSending(true); setError("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch(`/api/v1/tenant/invoices/${invoice.id}/payment-submissions`, { method: "POST", credentials: "same-origin", body });
      await apiData(response);
      setFile(null);
      await Promise.all([submissions.reload(), onChanged()]);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "ส่งสลิปไม่สำเร็จ"); }
    finally { setIsSending(false); }
  };
  return <section aria-label={`รายละเอียดบิล ${invoice.invoiceNumber}`} className="border-t border-[#e3e4e8] bg-[#fcfcfe] p-5" id={id}>
    {detail.isLoading ? <Loading /> : detail.data ? <div className="grid gap-2">{detail.data.items.map((item) => <div className="flex justify-between gap-3 rounded-xl bg-[#f3f3f5] p-3" key={item.id}><span>{item.description} × {item.quantity}</span><strong>{currency.format(Number(item.amount))}</strong></div>)}<div className="flex justify-between p-3 text-lg"><span>ค่าปรับ</span><strong>{currency.format(Number(detail.data.lateFee))}</strong></div></div> : <ErrorState error={detail.error} retry={() => void detail.reload()} />}
    {payable && !readOnly ? <div className="mt-5 grid gap-4 rounded-2xl border border-brand/20 p-4">
      <PromptPayQr invoice={invoice} />
      <label><span>อัปโหลดสลิป PNG, JPG หรือ PDF ไม่เกิน 5 MB</span><input accept="image/png,image/jpeg,application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" /></label>
      {error ? <p className="form-alert error" role="alert">{error}</p> : null}
      <button aria-describedby={!file && !isSending ? "payment-slip-disabled-reason" : undefined} className="primary-button" disabled={!file || isSending} onClick={() => void submit()} type="button"><Upload size={17} />{isSending ? "กำลังส่ง..." : "ส่งหลักฐาน"}</button>
      {!file && !isSending ? <p className="disabled-reason" id="payment-slip-disabled-reason">เลือกไฟล์สลิปก่อนส่งหลักฐานการชำระเงิน</p> : null}
    </div> : payable && readOnly ? <ReadOnlyNotice className="mt-5">ตรวจสอบรายละเอียดและประวัติหลักฐานได้ แต่ไม่สามารถชำระหรือส่งสลิปใหม่ได้</ReadOnlyNotice> : null}
    <div className="mt-5"><strong>ประวัติหลักฐาน</strong>{submissions.data?.map((item) => <div className="mt-2 flex justify-between rounded-xl bg-[#f3f3f5] p-3" key={item.id}><span>{new Date(item.submittedAt).toLocaleString("th-TH")}</span><span><Status value={item.status} />{item.rejectionNote ? <small className="block">{item.rejectionNote}</small> : null}</span></div>)}{submissions.data?.length === 0 ? <p className="mt-2 text-[#73757d]">ยังไม่เคยส่งหลักฐาน</p> : null}</div>
  </section>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Prompt Pay Qr” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { invoice }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function PromptPayQr({ invoice }: { invoice: Invoice }) {
  const promptPay = useApiResource<{ invoiceNumber: string; amount: string; payload: string }>(`/api/v1/tenant/invoices/${invoice.id}/promptpay-qr?format=json`);
  if (promptPay.isLoading) return <Loading />;
  if (promptPay.error || !promptPay.data) return <div className="form-alert error">{promptPay.error || "ไม่สามารถสร้าง PromptPay QR ได้"}</div>;
  return <div className="text-center">
    <strong className="block text-lg">สแกน PromptPay</strong>
    <Image alt={`PromptPay QR ${invoice.invoiceNumber}`} className="mx-auto mt-3 rounded-2xl" height={240} src={`/api/v1/tenant/invoices/${invoice.id}/promptpay-qr`} unoptimized width={240} />
    <p className="mt-2 text-sm text-[#73757d]">ยอด {currency.format(Number(promptPay.data.amount))}</p>
  </div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Lease” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Lease = { id: string; leaseNumber: string; status: string; startDate: string; endDate: string; monthlyRent: string; depositAmount: string; currentVersion: number; activatedAt: string | null; room: { number: string } };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Lease Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function LeasePanel() {
  const resource = useApiResource<{ current: Lease | null; upcoming: Lease | null }>("/api/v1/tenant/lease");
  if (resource.isLoading) return <Loading />;
  if (resource.error) return <ErrorState error={resource.error} retry={() => void resource.reload()} />;
  if (!resource.data?.current && !resource.data?.upcoming) return <Empty icon={<FileText />} text="ยังไม่มีสัญญาที่พร้อมแสดง" />;
  return <div className="grid gap-5">
    {resource.data.current ? <TenantLeaseCard lease={resource.data.current} title="สัญญาปัจจุบัน" /> : <Empty icon={<FileText />} text="ไม่มีสัญญาที่กำลังใช้งานในขณะนี้" />}
    {resource.data.upcoming ? <TenantLeaseCard lease={resource.data.upcoming} title="สัญญารอบถัดไป" /> : null}
  </div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant Lease Card” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { lease, title }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TenantLeaseCard({ lease, title }: { lease: Lease; title: string }) {
  return <section aria-labelledby={`tenant-lease-${lease.id}`} className="grid gap-2">
    <h2 className="text-lg font-black text-[#292a30]" id={`tenant-lease-${lease.id}`}>{title}</h2>
    <Panel title={lease.leaseNumber}>
    <div className="grid gap-4 sm:grid-cols-2"><Info label="สถานะ" value={formatStatus(lease.status)} /><Info label="Version" value={`v${lease.currentVersion}`} /><Info label="วันเริ่มต้น" value={new Date(lease.startDate).toLocaleDateString("th-TH")} /><Info label="วันสิ้นสุด" value={new Date(lease.endDate).toLocaleDateString("th-TH")} /><Info label="ค่าเช่า" value={currency.format(Number(lease.monthlyRent))} /><Info label="เงินประกัน" value={currency.format(Number(lease.depositAmount))} /></div>
    <a className="primary-button mt-5 inline-flex" href={`/api/v1/tenant/lease/signed-document?leaseId=${encodeURIComponent(lease.id)}`} rel="noreferrer" target="_blank"><FileText size={17} /> เปิดเอกสารลงนาม</a>
    </Panel>
  </section>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Announcement” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Announcement = { id: string; title: string; content: string; publishedAt: string | null; publishAt: string | null; createdAt: string };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Announcements Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function AnnouncementsPanel() {
  const resource = usePaginatedResource<Announcement>("/api/v1/tenant/announcements");
  return <ResourceList resource={resource} title="ประกาศจากหอพัก" subtitle="ข่าวสารที่ส่งถึงอาคาร ชั้น หรือห้องของคุณ" empty="ยังไม่มีประกาศ">{(item) => <Panel key={item.id} title={item.title}><p className="whitespace-pre-wrap">{item.content}</p><time className="mt-3 block text-sm text-[#73757d]">{new Date(item.publishedAt ?? item.publishAt ?? item.createdAt).toLocaleString("th-TH")}</time></Panel>}</ResourceList>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Parcel” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Parcel = { id: string; status: string; note: string | null; registeredAt: string; receivedAt: string | null; imageUrl: string | null };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Parcels Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
            <td>{item.imageUrl ? <Image alt="รูปพัสดุ" className="size-14 rounded-xl object-cover" height={56} src={item.imageUrl} unoptimized width={56} /> : <span className="text-[#73757d]">ไม่มีรูป</span>}</td>
            <td>{item.note || "ไม่มีหมายเหตุ"}</td>
            <td>{new Date(item.registeredAt).toLocaleString("th-TH")}</td>
            <td>{item.receivedAt ? new Date(item.receivedAt).toLocaleString("th-TH") : "—"}</td>
            <td><Status value={item.status} /></td>
          </tr>)}</tbody>
        </table>
      </TenantHistoryTable><PaginationActions resource={resource} /></div> : <ResourceList resource={resource} title="พัสดุของห้อง" subtitle="ตรวจสอบพัสดุที่หอรับไว้ให้" empty={view === "current" ? "ไม่มีพัสดุรอรับ" : "ยังไม่มีประวัติการรับพัสดุ"}>{(item) => <Panel key={item.id} title={item.status === "WAITING" ? "รอรับพัสดุ" : "รับแล้ว"}><div className="flex gap-4">{item.imageUrl ? <Image alt="รูปพัสดุ" className="size-24 rounded-xl object-cover" height={96} src={item.imageUrl} unoptimized width={96} /> : null}<div><p>{item.note || "ไม่มีหมายเหตุ"}</p><time className="text-sm text-[#73757d]">รับเข้าระบบ {new Date(item.registeredAt).toLocaleString("th-TH")}</time>{item.receivedAt ? <time className="mt-1 block text-sm text-[#73757d]">รับพัสดุแล้ว {new Date(item.receivedAt).toLocaleString("th-TH")}</time> : null}</div></div></Panel>}</ResourceList>}
    </div>
  </div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Ticket” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tickets Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { onUnreadChanged, readOnly }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TicketsPanel({ onUnreadChanged, readOnly }: { onUnreadChanged: () => Promise<void>; readOnly: boolean }) {
  const [view, setView] = useState<TenantRecordView>("current");
  const currentResource = usePaginatedResource<Ticket>("/api/v1/tenant/tickets?view=current");
  const historyResource = usePaginatedResource<Ticket>("/api/v1/tenant/tickets?view=history");
  const resource = view === "current" ? currentResource : historyResource;
  const reloadCurrentTickets = currentResource.reload;
  const reloadTicketHistory = historyResource.reload;
  const [isOpen, setIsOpen] = useState(false);
  const [openReplyTicketId, setOpenReplyTicketId] = useState<string | null>(null);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “reload Tickets” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const reloadTickets = useCallback(async () => {
    await Promise.all([reloadCurrentTickets(), reloadTicketHistory()]);
  }, [reloadCurrentTickets, reloadTicketHistory]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “change View” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - nextView: ค่า “next View” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const changeView = (nextView: TenantRecordView) => {
    setOpenReplyTicketId(null);
    setView(nextView);
  };
  return <div className="grid gap-5"><div className="flex flex-wrap items-center justify-between gap-3"><TenantHistoryTabs currentLabel="กำลังดำเนินการ" historyLabel="ประวัติเรื่อง" id="tenant-tickets" onChange={changeView} view={view} />{!readOnly ? <button className="primary-button" onClick={() => setIsOpen(true)} type="button"><Wrench size={17} /> แจ้งเรื่อง</button> : null}</div>
    {readOnly ? <ReadOnlyNotice>ดูสถานะ ประวัติ และไฟล์แนบเดิมได้ แต่ไม่สามารถสร้างหรือตอบกลับรายการได้</ReadOnlyNotice> : null}
    <div aria-labelledby={`tenant-tickets-tab-${view}`} id="tenant-tickets-panel" role="tabpanel" tabIndex={0}>
    {resource.isLoading ? <Loading /> : resource.error && !resource.data.length ? <ErrorState error={resource.error} retry={() => void resource.reload()} /> : resource.data.length ? view === "history" ? <TenantHistoryTable title="ประวัติเรื่องแจ้ง" total={historyResource.total}>
      <table>
        <thead><tr><th scope="col">หัวข้อ</th><th scope="col">ประเภท</th><th scope="col">วันที่แจ้ง</th><th scope="col">สถานะ</th><th aria-label="จัดการ" scope="col" /></tr></thead>
        <tbody>{resource.data.map((ticket) => {
          const isExpanded = openReplyTicketId === ticket.id;
          const detailsId = `tenant-ticket-history-${ticket.id}`;
          return <Fragment key={ticket.id}>
            <tr>
              <th className="px-6 py-4 text-sm font-bold" scope="row">{ticket.title}</th>
              <td>{ticket.type === "REPAIR" ? "แจ้งซ่อม" : "ร้องเรียน"}</td>
              <td>{new Date(ticket.createdAt).toLocaleString("th-TH")}</td>
              <td><Status value={ticket.status} /></td>
              <td><button aria-controls={detailsId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "ยุบ" : "ขยาย"}รายละเอียด ${ticket.title}`} className="grid size-10 place-items-center rounded-xl bg-[#f1f1f3] text-[#555761]" onClick={() => setOpenReplyTicketId(isExpanded ? null : ticket.id)} type="button"><ChevronDown aria-hidden="true" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={20} /></button></td>
            </tr>
            {isExpanded ? <tr><td className="p-0!" colSpan={5}><div className="p-5" id={detailsId}><TicketDetailsContent onRead={() => { void resource.reload(); void onUnreadChanged(); }} readOnly={readOnly} showReplyThread ticket={ticket} /></div></td></tr> : null}
          </Fragment>;
        })}</tbody>
      </table>
    </TenantHistoryTable> : resource.data.map((ticket) => <Panel key={ticket.id} title={ticket.title}><TicketDetailsContent onRead={() => { void resource.reload(); void onUnreadChanged(); }} readOnly={readOnly} showReplyThread={openReplyTicketId === ticket.id} ticket={ticket} toggleReply={() => setOpenReplyTicketId((current) => current === ticket.id ? null : ticket.id)} /></Panel>) : <Empty icon={<Wrench />} text={view === "current" ? "ไม่มีเรื่องที่กำลังดำเนินการ" : "ยังไม่มีประวัติเรื่อง"} />}
    {resource.error && resource.data.length ? <p className="form-alert error" role="alert">{resource.error}</p> : null}
    <PaginationActions resource={resource} />
    </div>
    {isOpen && !readOnly ? <TicketDialog onClose={() => setIsOpen(false)} onCreated={reloadTickets} /> : null}
  </div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Ticket Details Content” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { onRead, readOnly, showReplyThread, ticket, toggleReply }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TicketDetailsContent({ onRead, readOnly, showReplyThread, ticket, toggleReply }: {
  onRead: () => void;
  readOnly: boolean;
  showReplyThread: boolean;
  ticket: Ticket;
  toggleReply?: () => void;
}) {
  return <>
    <div className="flex flex-wrap gap-2"><Status value={ticket.status} /><span className="badge">{ticket.type === "REPAIR" ? "แจ้งซ่อม" : "ร้องเรียน"}</span><span className="badge">{formatStatus(ticket.priority)}</span>{ticket.hasUnreadReply ? <span className="badge bg-red-600 text-white">มีข้อความใหม่</span> : null}</div>
    <p className="mt-3 whitespace-pre-wrap">{ticket.detail}</p>
    {ticket.attachments.map((file) => <a className="mt-3 flex items-center gap-2 text-brand underline" href={`/api/v1/tenant/tickets/${ticket.id}/attachments/${file.id}`} key={file.id} rel="noreferrer" target="_blank"><Paperclip size={15} />{file.fileName}</a>)}
    <ol className="mt-4 grid gap-2 border-t pt-4">{ticket.events.map((event) => <li className="text-sm text-[#73757d]" key={event.id}><time>{new Date(event.createdAt).toLocaleString("th-TH")}</time> · {event.type === "CREATED" ? "สร้างรายการ" : event.type === "STATUS_CHANGED" ? `เปลี่ยนสถานะ ${formatStatus(event.fromValue)} → ${formatStatus(event.toValue)}` : event.type === "PRIORITY_CHANGED" ? `เปลี่ยนความสำคัญ ${formatStatus(event.fromValue)} → ${formatStatus(event.toValue)}` : event.type === "REPLY_ADDED" ? "มีข้อความตอบกลับ" : "แนบไฟล์"}</li>)}</ol>
    {toggleReply ? <button className="secondary-button mt-4" onClick={toggleReply} type="button"><MessageSquare size={16} /> {showReplyThread ? "ปิดการตอบกลับ" : "เปิดการตอบกลับ"}</button> : null}
    {showReplyThread ? <TicketReplyThread endpoint={`/api/v1/tenant/tickets/${ticket.id}/replies`} onRead={onRead} readOnly={readOnly} viewerRole="TENANT" /> : null}
  </>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Ticket Dialog” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { onClose, onCreated }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ type: "REPAIR", title: "", detail: "", priority: "NORMAL", isAnonymous: false });
  const [file, setFile] = useState<File | null>(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submit = async (event: FormEvent) => {
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
  return <Dialog ariaDescribedBy="tenant-ticket-description" ariaLabelledBy="tenant-ticket-title" onClose={onClose}><header className="modal-header"><div><h2 id="tenant-ticket-title">แจ้งเรื่องใหม่</h2><p id="tenant-ticket-description">ส่งรายการแจ้งซ่อมหรือร้องเรียนถึงผู้ดูแลหอพัก</p></div><IconButton label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างแจ้งเรื่อง"><X /></IconButton></header><form className="modal-form" onSubmit={submit}>
    <div className="modal-grid"><DropdownField label="ประเภท" onChange={(value) => setForm({ ...form, type: value })} options={[{ label: "แจ้งซ่อม", value: "REPAIR" }, { label: "ร้องเรียน", value: "COMPLAINT" }]} value={form.type} /><DropdownField label="ความเร่งด่วน" onChange={(value) => setForm({ ...form, priority: value })} options={[{ label: "ปกติ", value: "NORMAL" }, { label: "ด่วน", value: "URGENT" }]} value={form.priority} /></div>
    <label><span>หัวข้อ</span><input maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label><label><span>รายละเอียด</span><textarea maxLength={4000} onChange={(event) => setForm({ ...form, detail: event.target.value })} required value={form.detail} /></label>
    {form.type === "COMPLAINT" ? <label className="flex items-center gap-2"><input checked={form.isAnonymous} className="size-5 min-h-0" onChange={(event) => setForm({ ...form, isAnonymous: event.target.checked })} type="checkbox" /> ไม่แสดงชื่อกับผู้ดูแลหอ</label> : null}
    <label><span>แนบไฟล์ (ไม่บังคับ)</span><input accept="image/png,image/jpeg,application/pdf,.pdf" onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && next.size > 5 * 1024 * 1024) { setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB"); event.target.value = ""; setFile(null); return; } setError(""); setFile(next); }} type="file" /></label>{error ? <p className="form-alert error">{error}</p> : null}<footer className="modal-actions"><button onClick={onClose} type="button">ปิด</button><button className="primary-button" disabled={saving} type="submit">{saving ? "กำลังส่ง..." : createdTicketId ? "ลองอัปโหลดไฟล์อีกครั้ง" : "ส่งเรื่อง"}</button></footer>
  </form></Dialog>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Chat Message” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type ChatMessage = { id: string; body: string; senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN"; senderName: string; createdAt: string; attachment: { name: string; mimeType: string; size: number; url: string } | null };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant Chat” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { onClose, propertyId, readOnly, variant = "page", }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TenantChat({
  onClose,
  propertyId,
  readOnly,
  variant = "page",
}: {
  onClose?: () => void;
  propertyId: string;
  readOnly: boolean;
  variant?: "page" | "widget";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [conversationId, setConversationId] = useState<string | null>(null); const [text, setText] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [loadingOlder, setLoadingOlder] = useState(false); const [hasOlderMessages, setHasOlderMessages] = useState(false); const [sending, setSending] = useState(false); const endRef = useRef<HTMLDivElement>(null); const scrollRef = useRef<HTMLDivElement>(null); const shouldScrollToEndRef = useRef(true);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch("/api/v1/tenant/chat", { cache: "no-store" }); const payload = await response.json() as { conversationId?: string; hasMore?: boolean; messages?: ChatMessage[]; error?: string }; if (!response.ok || !payload.messages || !payload.conversationId) throw new Error(payload.error || "โหลดแชตไม่สำเร็จ"); setMessages(payload.messages); setHasOlderMessages(payload.hasMore ?? false); setConversationId(payload.conversationId); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "โหลดแชตไม่สำเร็จ"); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!conversationId) return; const stream = new EventSource(`/api/v1/chat/conversations/${conversationId}/stream?propertyId=${encodeURIComponent(propertyId)}&after=${encodeURIComponent(new Date().toISOString())}`); stream.onmessage = (event) => { const message = JSON.parse(event.data) as ChatMessage; setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]); }; stream.onerror = () => setError("การเชื่อมต่อข้อความขัดข้อง ระบบกำลังเชื่อมต่อใหม่"); return () => stream.close(); }, [conversationId, propertyId]);
  useEffect(() => {
    if (shouldScrollToEndRef.current) endRef.current?.scrollIntoView({ behavior: "smooth" });
    shouldScrollToEndRef.current = true;
  }, [messages]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Older” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true); setError("");
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      const search = new URLSearchParams({ beforeMessageId: oldest.id, limit: "50" });
      const response = await fetch(`/api/v1/tenant/chat?${search}`, { cache: "no-store" });
      const payload = await response.json() as { hasMore?: boolean; messages?: ChatMessage[]; error?: string };
      if (!response.ok || !payload.messages) throw new Error(payload.error || "โหลดข้อความก่อนหน้าไม่สำเร็จ");
      shouldScrollToEndRef.current = false;
      setMessages((current) => [
        ...payload.messages!.filter((item) => !current.some((existing) => existing.id === item.id)),
        ...current,
      ]);
      setHasOlderMessages(payload.hasMore ?? false);
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อความก่อนหน้าไม่สำเร็จ");
    } finally { setLoadingOlder(false); }
  };
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “send” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if ((!body && !attachment) || !conversationId) return;
    setSending(true); setError("");
    try {
      const clientId = crypto.randomUUID();
      const response = attachment
        ? await fetch(`/api/v1/chat/conversations/${conversationId}/attachments`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "x-property-id": propertyId },
          body: (() => {
            const formData = new FormData();
            formData.set("propertyId", propertyId);
            formData.set("body", body);
            formData.set("clientId", clientId);
            formData.set("file", attachment);
            return formData;
          })(),
        })
        : await fetch("/api/v1/tenant/chat", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, clientId }),
        });
      const payload = await response.json() as { message?: ChatMessage; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error || "ส่งข้อความไม่สำเร็จ");
      setMessages((current) => current.some((item) => item.id === payload.message!.id) ? current : [...current, payload.message!]);
      setText("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "ส่งข้อความไม่สำเร็จ");
    } finally { setSending(false); }
  };
  const messageList = (
    <div className={variant === "widget" ? "tenant-quick-chat-messages" : "tenant-chat-message-list my-4 h-[420px] overflow-y-auto rounded-2xl bg-[#f3f3f5] p-4"} ref={scrollRef}>
      {loading ? <Loading /> : messages.length === 0 ? (
        <p className="m-auto text-center text-sm text-[#73757d]">ยังไม่มีข้อความ เริ่มพูดคุยกับหอพักได้เลย</p>
      ) : <>
        {hasOlderMessages ? <LoadMoreButton className="mb-3 border-t-0 p-0" isLoading={loadingOlder} label="โหลดข้อความก่อนหน้า" onClick={() => void loadOlder()} /> : null}
        {messages.map((message) => (
          <article className={`chat-message ${message.senderRole === "TENANT" ? "from-tenant" : "from-admin"}`} key={message.id}>
            <strong>{message.senderName}</strong>
            {message.body ? <p>{message.body}</p> : null}
            {message.attachment ? message.attachment.mimeType.startsWith("image/") ? (
              <a className="chat-image-attachment" href={message.attachment.url} rel="noreferrer" target="_blank">
                <Image alt={message.attachment.name} height={240} src={message.attachment.url} unoptimized width={320} />
              </a>
            ) : (
              <a className="chat-file-attachment" href={message.attachment.url} rel="noreferrer" target="_blank">
                <FileText aria-hidden="true" size={22} />
                <span><strong>{message.attachment.name}</strong><small>{(message.attachment.size / 1024).toFixed(1)} KB</small></span>
              </a>
            ) : null}
            <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString("th-TH")}</time>
          </article>
        ))}
      </>}
      <div ref={endRef} />
    </div>
  );

  const composer = readOnly ? (
    <div className={variant === "widget" ? "p-3" : undefined}>
      <ReadOnlyNotice>อ่านประวัติข้อความได้ แต่ไม่สามารถส่งข้อความใหม่ได้</ReadOnlyNotice>
    </div>
  ) : (
    <form className={variant === "widget" ? "chat-composer" : "tenant-chat-composer"} onSubmit={send}>
      {attachment ? <div className="chat-attachment-preview">
        <FileText aria-hidden="true" size={18} />
        <span>{attachment.name}</span>
        <IconButton label="นำไฟล์แนบออก" onClick={() => {
          setAttachment(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }} size="sm"><X aria-hidden="true" size={16} /></IconButton>
      </div> : null}
      <div className="flex gap-2">
        <input
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="chat-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file && file.size > 5 * 1024 * 1024) {
              setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
              event.target.value = "";
              return;
            }
            setError("");
            setAttachment(file);
          }}
          ref={fileInputRef}
          type="file"
        />
        <IconButton className="chat-attach-button" disabled={sending} label="แนบรูปหรือไฟล์" onClick={() => fileInputRef.current?.click()}>
          <Paperclip aria-hidden="true" size={18} />
        </IconButton>
        <input
          aria-label="ข้อความถึงหอพัก"
          className="min-w-0 flex-1 rounded-xl border border-[#d7d8df] px-4"
          maxLength={4000}
          onChange={(event) => setText(event.target.value)}
          placeholder="พิมพ์ข้อความ..."
          value={text}
        />
        <button aria-label={sending ? "กำลังส่งข้อความ" : "ส่งข้อความ"} className={variant === "widget" ? undefined : "primary-button"} disabled={sending || (!text.trim() && !attachment)} type="submit">
          {sending ? <LoaderCircle className="animate-spin" size={17} /> : <Send aria-hidden="true" size={17} />}
          {variant === "page" ? <span>{sending ? "กำลังส่ง..." : "ส่ง"}</span> : null}
        </button>
      </div>
      {variant === "page" && !text.trim() && !attachment && !sending ? <p className="disabled-reason mt-2">พิมพ์ข้อความหรือแนบไฟล์ก่อนกดส่ง</p> : null}
    </form>
  );

  if (variant === "widget") {
    return <aside aria-label="แชทกับหอพัก" aria-modal="false" className={`chat-widget tenant-chat-widget${isExpanded ? " expanded" : ""}`} role="dialog">
      <header className="chat-widget-header">
        <div className="chat-conversation-brand">
          <span className="chat-person-avatar support"><MessageSquare aria-hidden="true" size={19} /></span>
          <span>
            <strong className="block">ติดต่อหอ</strong>
            <small className="block text-[#73757d]">ข้อความถึงผู้ดูแลหอพัก</small>
          </span>
        </div>
        <div className="chat-header-actions">
          <div className="chat-options">
            <IconButton aria-expanded={isOptionsOpen} label="ตัวเลือกหน้าต่างแชท" onClick={() => setIsOptionsOpen((current) => !current)}>
              <MoreHorizontal aria-hidden="true" size={21} />
            </IconButton>
            {isOptionsOpen ? <div className="chat-options-menu">
              <button onClick={() => { setIsExpanded((current) => !current); setIsOptionsOpen(false); }} type="button">
                {isExpanded ? <Shrink aria-hidden="true" size={18} /> : <Expand aria-hidden="true" size={18} />}
                {isExpanded ? "ย่อหน้าต่าง" : "ขยายหน้าต่าง"}
              </button>
            </div> : null}
          </div>
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Resource List” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, empty, resource }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function ResourceList<T extends { id: string }>({ children, empty, resource }: { children: (item: T) => ReactNode; empty: string; resource: PaginatedResource<T>; subtitle: string; title: string }) {
  if (resource.isLoading) return <Loading />; if (resource.error && !resource.data.length) return <ErrorState error={resource.error} retry={() => void resource.reload()} />;
  return <div className="grid gap-5"><LiveAnnouncement message={resource.isLoadingMore ? "กำลังโหลดรายการเพิ่มเติม" : `กำลังแสดง ${resource.data.length.toLocaleString("th-TH")} รายการ${resource.hasNextPage ? " และยังมีรายการเพิ่มเติม" : ""}`} />{resource.data.length ? resource.data.map(children) : <Empty icon={<Bell />} text={empty} />}{resource.error ? <p className="form-alert error" role="alert">{resource.error}</p> : null}<PaginationActions resource={resource} /></div>;
}
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Pagination Actions” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { resource }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function PaginationActions<T>({ resource }: { resource: PaginatedResource<T> }) {
  if (!resource.hasNextPage) return null;
  return <button className="secondary-button mx-auto" disabled={resource.isLoadingMore} onClick={() => void resource.loadMore()} type="button">
    {resource.isLoadingMore ? <><LoaderCircle className="animate-spin" size={17} /> กำลังโหลด...</> : "โหลดรายการเพิ่มเติม"}
  </button>;
}
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, title }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Panel({ children, title }: { children: ReactNode; title: string }) { return <section className="panel"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</section>; }
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Info Card” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function InfoCard({ label, value }: { label: string; value: string }) { return <article className="panel"><small>{label}</small><strong className="mt-2 block text-2xl">{value}</strong></article>; }
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Info” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-sm text-[#73757d]">{label}</dt><dd className="font-bold">{value}</dd></div>; }
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Loading” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Loading() { return <LoadingSkeleton count={3} label="กำลังโหลดข้อมูล" variant="list" />; }
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Error State” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { error, retry }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function ErrorState({ error, retry }: { error: string; retry: () => void }) { return <div className="form-alert error" role="alert"><span>{error || "โหลดข้อมูลไม่สำเร็จ"}</span><RetryButton onClick={retry} /></div>; }
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Empty” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { icon, text }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Empty({ icon, text }: { icon: ReactNode; text: string }) { return <div className="empty-state">{icon}<p>{text}</p></div>; }
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Restricted Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { message }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function RestrictedPanel({ message }: { message: string }) { return <Empty icon={<QrCode />} text={message} />; }
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Status” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Status({ value }: { value: string }) {
  return <span className={`badge ${["PAID", "APPROVED", "RESOLVED"].includes(value) ? "badge-paid" : ""}`}>{formatStatus(value)}</span>;
}
