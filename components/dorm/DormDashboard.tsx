"use client";
// ถือ state ของทั้งพื้นที่เจ้าของหอ และโหลดข้อมูลใหม่จากเบราว์เซอร์

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { RetryButton } from "@/components/ui/DataNavigation";
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
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { useOwnerWorkspaceData } from "@/components/dorm/useOwnerWorkspaceData";
import { buildNotificationCounts, buildOwnerNotifications } from "@/components/dorm/owner-notifications";
import { SubscriptionAccessBanner, WorkspaceDataError } from "@/components/dorm/OwnerShellParts";
import { type DashboardProperty, isSettingsArea, OwnerSidebar } from "@/components/dorm/OwnerSidebar";
import {
  type MeterReadingInput,
  saveMetersRequest,
  saveRoomRequest,
  saveTenantDetailRequest,
  saveTenantRequest,
} from "@/components/dorm/owner-mutations";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { PageHeaderSlotProvider, PageHeaderTarget } from "@/components/ui/PageHeaderSlot";
import { OwnerGlobalSearch } from "@/components/dorm/OwnerGlobalSearch";

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
}: Readonly<{
  authenticatedEmail?: string;
  authenticatedUser?: string;
  availableProperties: DashboardProperty[];
  children: ReactNode;
  initialAggregation: OwnerDashboardAggregation;
  initialData: OwnerWorkspaceReadModel;
  propertyId: string;
}>) {
  const router = useRouter();
  // อ่านหน้าปัจจุบันจาก URL แทนการรับเป็น prop เพราะ layout ไม่รู้พารามิเตอร์ของ route ลูก
  const pathname = usePathname();
  const activePage = ownerPageFromSegments(
    pathname.replace(new RegExp(`^/admin/properties/${propertyId}/?`), "").split("/").filter(Boolean),
  ) ?? "overview";
  const [currentUser, setCurrentUser] = useState(authenticatedUser ?? "");
  const [parcelView] = useState<ParcelView>("waiting");
  const [shouldOpenComplaintAdd, setShouldOpenComplaintAdd] = useState(false);
  // ข้อมูลร่วมทั้งหมดและการโหลดใหม่อยู่ในฮุก เปลือกนี้เหลือหน้าที่ประกอบหน้าจอ
  const {
    accessError, aggregation, dashboardData, dataError, invoices, isRefreshing,
    refreshDashboard, repairTickets, rooms, setDataError, setTenants, tenants,
  } = useOwnerWorkspaceData({ initialAggregation, initialData, propertyId });
  const [unreadTicketReplies, setUnreadTicketReplies] = useState(0);
  const [openChatSignal, setOpenChatSignal] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState(initialData.rooms[0]?.id ?? "");
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [tenantModalMode] = useState<"add" | "edit">("edit");
  const [detailTenantId, setDetailTenantId] = useState<string | null>(null);
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
  // ตรวจสิทธิ์ไม่สำเร็จกับกำลังตรวจอยู่ ต่างจากหมดอายุจริง จึงต้องบอกคนละข้อความ
  const unresolvedAccess = accessState === "loading" || accessState === "error";
  const readOnlyMessage = "แพ็กเกจหมดอายุแล้ว พื้นที่นี้เปิดให้อ่านข้อมูลเท่านั้น กรุณาต่ออายุแพ็กเกจ";

  // เรียกก่อนทุกการกระทำที่เปลี่ยนข้อมูล คืน false พร้อมขึ้นข้อความบอกเหตุผล
  const ensureWritable = () => {
    if (!isReadOnly) return true;
    setDataError(unresolvedAccess ? "ยังตรวจสอบสิทธิ์การใช้งานไม่ได้ กรุณาลองโหลดข้อมูลใหม่" : readOnlyMessage);
    return false;
  };

  // ทุกหน้ามี URL ของตัวเอง เปลี่ยนหน้าจึงเป็นการเปลี่ยนเส้นทางจริง ไม่ใช่แค่สลับ state
  const navigateTo = useCallback((page: PageKey) => {
    router.push(ownerPagePath(propertyId, page));
  }, [propertyId, router]);

  // จำไว้ว่าข้อมูลในมือเป็นของหอไหน layout ดึงมาให้ตั้งแต่ฝั่งเซิร์ฟเวอร์แล้ว จึงเริ่มที่หอปัจจุบันเลย
  const [loadedPropertyId, setLoadedPropertyId] = useState(propertyId);
  // โหลดใหม่เฉพาะตอนสลับไปหออื่น เทียบค่าแทนการนับรอบ เพราะ StrictMode เรียก effect ซ้ำตอน dev
  useEffect(() => {
    if (loadedPropertyId === propertyId) return;
    setLoadedPropertyId(propertyId);
    void refreshDashboard();
  }, [loadedPropertyId, propertyId, refreshDashboard]);

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



  const summary: DashboardSummary | null = aggregation ? {
    occupied: aggregation.rooms.occupied,
    overdue: aggregation.finance.overdueInvoices,
    revenue: aggregation.finance.collected,
    pending: aggregation.finance.outstanding,
  } : null;
  const notificationCounts = buildNotificationCounts(aggregation, unreadTicketReplies);


  const ownerNotifications = buildOwnerNotifications({
    accessState,
    aggregation,
    isReadOnly,
    onOpenChat: () => setOpenChatSignal((current) => current + 1),
    propertyId,
    unreadTicketReplies,
  });

  // รูปแบบเดียวกันทั้งสามหน้าต่าง สำเร็จแล้วปิดหน้าต่างและโหลดข้อมูลใหม่ พังก็ขึ้นข้อความไว้บนหน้า
  const runMutation = async (send: () => Promise<void>, onDone: () => void, fallbackMessage: string) => {
    try {
      await send();
      onDone();
      await refreshDashboard();
    } catch (error: unknown) {
      setDataError(error instanceof Error ? error.message : fallbackMessage);
    }
  };

  // ทุกตัวด้านล่างเป็นแค่ตัวเชื่อม คำขอจริงอยู่ใน owner-mutations ส่วนการตรวจสิทธิ์จริงอยู่ที่เซิร์ฟเวอร์
  // โยน error ต่อแทนการกลืน เพราะหน้าที่เรียกต้องรู้ว่าไม่สำเร็จเพื่อคงร่างไว้ให้ผู้ใช้
  const saveMeters = async (readings: MeterReadingInput[]) => {
    if (!ensureWritable()) throw new Error(readOnlyMessage);
    await saveMetersRequest(propertyId, readings);
    await refreshDashboard();
  };

  const saveRoomEdit = ({ room }: RoomEditPayload) => {
    if (!ensureWritable()) return;
    void runMutation(() => saveRoomRequest(propertyId, room), () => setIsRoomModalOpen(false), "บันทึกห้องไม่สำเร็จ");
  };

  const saveTenantEdit = ({ tenant }: TenantEditPayload) => {
    if (!ensureWritable()) return;
    if (tenantModalMode === "add") {
      setDataError("ผู้เช่าต้องสมัครด้วยรหัสเชิญ แล้วเจ้าของหอจึงอนุมัติการเข้าพัก");
      return;
    }
    void runMutation(() => saveTenantRequest(propertyId, tenant), () => setIsTenantModalOpen(false), "บันทึกผู้เช่าไม่สำเร็จ");
  };

  const saveTenantDetail = (tenant: Tenant) => {
    if (!ensureWritable()) return;
    void runMutation(() => saveTenantDetailRequest(propertyId, tenant), () => setDetailTenantId(null), "บันทึกผู้เช่าไม่สำเร็จ");
  };

  const inSettingsArea = isSettingsArea(activePage);

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
    <main className={inSettingsArea ? "shell shell-settings" : "shell"}>
      <OwnerSidebar
        accountEmail={authenticatedEmail ?? ""}
        accountName={currentUser}
        activePage={activePage}
        activeProperty={activeProperty}
        availableProperties={availableProperties}
        isReadOnly={isReadOnly}
        navigateTo={navigateTo}
        notificationCounts={notificationCounts}
        propertyId={propertyId}
      />

      <section className={`${inSettingsArea ? "workspace settings-workspace" : "workspace"}${isReadOnly ? " workspace-read-only" : ""}`}>
        <LiveAnnouncement message={`เปิดหน้า ${pageTitles[activePage].title}`} />
        <SubscriptionAccessBanner
          accessState={accessState}
          aggregation={aggregation}
          isInGracePeriod={isInGracePeriod}
          isRefreshing={isRefreshing}
          onRetry={() => void refreshDashboard()}
          propertyId={propertyId}
        />
        <WorkspaceDataError message={dataError} onRetry={() => void refreshDashboard()} />
        {isRefreshing ? <output aria-atomic="true" className="document-editor-state">กำลังอัปเดตข้อมูล...</output> : null}
        {!inSettingsArea ? (
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

type OwnerSectionProps = {
  initialLeases?: { data: unknown[]; pageInfo: { page: number; pageSize: number; hasNextPage: boolean } } | null;
  initialParcels?: OwnerInitialParcels | null;
  initialRepairHistory?: { pageInfo: { page: number; pageSize: number; hasNextPage: boolean }; tickets: OwnerWorkspaceReadModel["repairs"] } | null;
  initialTenants?: { data: Tenant[]; pageInfo: { page: number; pageSize: number; hasNextPage: boolean } } | null;
  initialPendingRequests?: Parameters<typeof TenantsPage>[0]["initialPendingRequests"];
  initialPayments?: Parameters<typeof InvoicesPage>[0]["initialPayments"];
  initialComplaints?: Complaint[] | null;
  initialInvitations?: Parameters<typeof SettingsPage>[0]["initialInvitations"];
  initialSubscriptionData?: Parameters<typeof SettingsPage>[0]["initialSubscriptionData"];
  invoiceView?: "invoices" | "payments";
  page: PageKey;
};

// ข้อมูลทุกอย่างที่ตัวประกอบหน้าหนึ่งหน้าต้องใช้ ทั้งที่ Server Component ส่งมาและที่อยู่ใน context
type SectionContext = Required<Omit<OwnerSectionProps, "page">> & { page: PageKey; workspace: OwnerWorkspaceValue };

// เปิดมาที่หัวข้อไหนของหน้าตั้งค่า ขึ้นกับว่าเข้ามาจาก URL ไหน
function settingsSectionFor(page: PageKey) {
  if (page === "account") return "account";
  if (page === "invitations") return "invitations";
  if (page === "subscription") return "subscription";
  return "general";
}

// หน้าภาพรวมต้องมีข้อมูลสรุป ซึ่งมาจากคนละคำสั่งกับข้อมูลหลัก จึงพลาดได้เองโดยที่หน้าอื่นยังใช้ได้ปกติ
function OverviewSection({ workspace }: Readonly<{ workspace: OwnerWorkspaceValue }>) {
  const { aggregation, invoices, isReadOnly, isRefreshing, navigateTo, onOpenChat, refreshDashboard, rooms, summary, tenants } = workspace;
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

// แต่ละหน้าเป็นตัวประกอบของตัวเอง เขียนเป็นตารางแทนบันได if ที่ยาวเกินจะอ่านรวดเดียว
const sectionRenderers: Partial<Record<PageKey, (context: SectionContext) => ReactNode>> = {
  overview: ({ workspace }) => <OverviewSection workspace={workspace} />,
  rooms: ({ workspace }) => <RoomsPage
    invoices={workspace.invoices}
    onEditRoom={workspace.onEditRoom}
    readOnly={workspace.isReadOnly}
    rooms={workspace.rooms}
    selectedRoom={workspace.selectedRoom}
    setSelectedRoomId={workspace.setSelectedRoomId}
  />,
  tenants: ({ initialPendingRequests, initialTenants, workspace }) => <TenantsPage
    filteredTenants={initialTenants?.data ?? workspace.tenants}
    initialPageInfo={initialTenants?.pageInfo ?? null}
    initialPendingRequests={initialPendingRequests}
    onChanged={workspace.refreshDashboard}
    onOpenTenantDetail={workspace.onOpenTenantDetail}
    propertyId={workspace.propertyId}
    readOnly={workspace.isReadOnly}
    setSelectedRoomId={workspace.setSelectedRoomId}
  />,
  contracts: ({ initialLeases, workspace }) => <ContractsPage
    initialLeases={initialLeases?.data as Parameters<typeof ContractsPage>[0]["initialLeases"] ?? null}
    initialPageInfo={initialLeases?.pageInfo ?? null}
    propertyId={workspace.propertyId}
    propertyName={workspace.activeProperty.name}
    readOnly={workspace.isReadOnly}
    rooms={workspace.rooms}
  />,
  waterMeter: ({ page, workspace }) => <MetersPage
    mode={page === "waterMeter" ? "water" : "electric"}
    onSaveMeters={workspace.saveMeters}
    propertyId={workspace.propertyId}
    readOnly={workspace.isReadOnly}
  />,
  invoices: ({ initialPayments, invoiceView, workspace }) => <InvoicesPage
    initialPayments={initialPayments}
    initialView={invoiceView}
    invoices={workspace.invoices}
    onChanged={workspace.refreshDashboard}
    propertyId={workspace.propertyId}
    propertyName={workspace.activeProperty.name}
    readOnly={workspace.isReadOnly}
    rooms={workspace.rooms}
  />,
  repairHistory: ({ initialRepairHistory, workspace }) => <RepairHistoryPage
    initialPageInfo={initialRepairHistory?.pageInfo ?? null}
    propertyId={workspace.propertyId}
    tickets={initialRepairHistory?.tickets ?? workspace.repairTickets}
  />,
  complaints: ({ initialComplaints, workspace }) => <ComplaintsPage
    complaints={initialComplaints ?? workspace.dashboardData.complaints}
    initialLoaded={initialComplaints !== null}
    onAddRequestHandled={workspace.onAddComplaintHandled}
    onChanged={workspace.refreshDashboard}
    onUnreadChanged={workspace.onUnreadChanged}
    openAddOnMount={workspace.openAddComplaint}
    propertyId={workspace.propertyId}
    readOnly={workspace.isReadOnly}
  />,
  parcels: ({ initialParcels, workspace }) => <ParcelsPage
    activeView={workspace.parcelView}
    initialHasNextPage={initialParcels?.hasNextPage ?? false}
    initialParcels={initialParcels?.items ?? workspace.dashboardData.parcels}
    initialSummary={initialParcels?.summary ?? null}
    onChanged={workspace.refreshDashboard}
    propertyId={workspace.propertyId}
    readOnly={workspace.isReadOnly}
    rooms={workspace.rooms}
  />,
  // ประกาศไม่ได้ดึงจากเซิร์ฟเวอร์ เพราะการแปลงต้องจับคู่เลขห้องกับรหัสห้องจาก rooms ฝั่งนี้
  // ซึ่ง Server Component ของหน้าไม่มีให้ ต้องยิงถามเพิ่มจนได้ไม่คุ้มเสีย
  announcements: ({ workspace }) => <AnnouncementsPage
    initialAnnouncements={workspace.dashboardData.announcements}
    onChanged={workspace.refreshDashboard}
    propertyId={workspace.propertyId}
    readOnly={workspace.isReadOnly}
    recipientRoomCount={workspace.rooms.filter((room) => room.status === "occupied").length}
    rooms={workspace.rooms}
  />,
  help: () => <HelpPage />,
  properties: ({ workspace }) => <PropertiesPage activePropertyId={workspace.propertyId} properties={workspace.availableProperties} />,
  // หน้าบัญชีกับหน้าตั้งค่าใช้คอมโพเนนต์เดียวกัน ต่างกันที่เปิดมาที่หัวข้อไหนและแก้ได้แค่ไหน
  // บัญชีเป็นข้อมูลของตัวผู้ใช้เอง จึงแก้ได้แม้หอจะอยู่ในโหมดอ่านอย่างเดียว
  account: ({ initialInvitations, initialSubscriptionData, page, workspace }) => <SettingsPage
    accountEmail={workspace.accountEmail}
    accountName={workspace.accountName}
    initialInvitations={initialInvitations}
    initialSubscriptionData={initialSubscriptionData}
    initialSection={settingsSectionFor(page)}
    initialSettings={workspace.dashboardData.settings}
    onAccountNameChange={workspace.onAccountNameChange}
    onDataChanged={workspace.refreshDashboard}
    propertyId={workspace.propertyId}
    readOnly={page === "account" ? false : workspace.isReadOnly}
    rooms={workspace.rooms}
    subscription={workspace.aggregation?.subscription ?? null}
  />,
};

// มิเตอร์สองหน้าและหน้าตั้งค่าสี่หน้าใช้ตัวประกอบร่วมกัน ชี้มาที่ตัวเดียวกันแทนการเขียนซ้ำ
sectionRenderers.electricMeter = sectionRenderers.waterMeter;
sectionRenderers.settings = sectionRenderers.account;
sectionRenderers.invitations = sectionRenderers.account;
sectionRenderers.subscription = sectionRenderers.account;

export function OwnerSectionPanel({
  initialLeases = null,
  initialParcels = null,
  initialRepairHistory = null,
  initialTenants = null,
  initialPendingRequests = null,
  initialPayments = null,
  initialComplaints = null,
  initialInvitations = null,
  initialSubscriptionData = null,
  invoiceView = "invoices",
  page,
}: OwnerSectionProps) {
  const workspace = useOwnerWorkspace();
  const render = sectionRenderers[page];
  if (!render) return null;
  return render({
    initialComplaints,
    initialInvitations,
    initialLeases,
    initialParcels,
    initialPayments,
    initialPendingRequests,
    initialRepairHistory,
    initialSubscriptionData,
    initialTenants,
    invoiceView,
    page,
    workspace,
  });
}
