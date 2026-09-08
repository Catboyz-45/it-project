"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Tenants Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarClock, Download, FileText, Search, UsersRound } from "lucide-react";
import { currency } from "@/lib/dorm-utils";
import type { Tenant } from "@/types/dorm";
import { ServerTablePagination, TablePagination, type ServerPageInfo, useTablePagination } from "@/components/dorm/TablePagination";
import { createApiError, formatClientError } from "@/lib/client/api-error";
import { PendingTenantApprovals } from "@/components/dorm/PendingTenantApprovals";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { LEASE_EXPIRY_NOTICE_DAYS, daysUntilLeaseExpiry, leaseDisplayStatus } from "@/lib/domain/lease-expiry";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenants Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { filteredTenants, onChanged, onOpenTenantDetail, propertyId: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function TenantsPage({
  filteredTenants,
  onChanged,
  onOpenTenantDetail,
  propertyId,
  readOnly = false,
  setSelectedRoomId,
}: {
  filteredTenants: Tenant[];
  onChanged: () => Promise<void>;
  onOpenTenantDetail: (tenant: Tenant) => void;
  propertyId: string;
  readOnly?: boolean;
  setSelectedRoomId: (roomId: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("tab");
  const initialView = requestedView === "pending" || requestedView === "transitions" ? requestedView : "active";
  const [view, setView] = useState<"active" | "pending" | "transitions">(initialView);
  const [query, setQuery] = useState("");
  const [tenants, setTenants] = useState(filteredTenants);
  const [pageInfo, setPageInfo] = useState<ServerPageInfo>({ page: 1, pageSize: 20, hasNextPage: false });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Tenants” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - signal: ค่า “signal” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadTenants = useCallback(async (targetPage = 1, signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tenants?page=${targetPage}&pageSize=20&query=${encodeURIComponent(query.trim())}`, {
        cache: "no-store", signal,
      });
      const payload = await response.json() as {
        data?: Tenant[];
        error?: string;
        requestId?: string;
        pageInfo?: ServerPageInfo;
      };
      if (!response.ok || !payload.data || !payload.pageInfo) throw createApiError(payload, "โหลดข้อมูลผู้เช่าไม่สำเร็จ");
      setTenants(payload.data);
      setPageInfo(payload.pageInfo);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(formatClientError(error, "โหลดข้อมูลผู้เช่าไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, query]);

  useEffect(() => {
    const controller = new AbortController();
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “timeout” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const timeout = window.setTimeout(() => void loadTenants(1, controller.signal), 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [loadTenants]);

  useEffect(() => {
    setView(requestedView === "pending" || requestedView === "transitions" ? requestedView : "active");
  }, [requestedView]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “select View” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - nextView: ค่า “next View” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const selectView = (nextView: "active" | "pending" | "transitions") => {
    setView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "active") params.delete("tab");
    else params.set("tab", nextView);
    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  };

  const expiring = tenants.filter((tenant) => {
    if (!tenant.contractEnd) return false;
    const remainingDays = daysUntilLeaseExpiry(tenant.contractEnd);
    return remainingDays !== null && remainingDays >= 0 && remainingDays <= LEASE_EXPIRY_NOTICE_DAYS;
  }).length;
  const withLease = tenants.filter((tenant) => tenant.leaseNumber).length;

  return (
    <section className="figma-list-page tenants-page-content">
      <div className="figma-summary-grid four">
        <Summary icon={<UsersRound />} label="ผู้เช่าที่โหลดแล้ว" value={`${tenants.length} คน`} tone="indigo" />
        <Summary icon={<Building2 />} label="ห้องในรายการ" value={`${new Set(tenants.map((tenant) => tenant.roomId)).size} ห้อง`} tone="blue" />
        <Summary icon={<FileText />} label="มีสัญญาในระบบ" value={`${withLease} คน`} tone="green" />
        <Summary icon={<CalendarClock />} label="สัญญาใกล้หมดอายุ" value={`${expiring} คน`} tone="orange" />
      </div>
      <div className="figma-inline-tabs invoice-tabs">
        <button className={view === "active" ? "active" : ""} onClick={() => selectView("active")} type="button">ผู้เช่าปัจจุบัน</button>
        <button className={view === "pending" ? "active" : ""} onClick={() => selectView("pending")} type="button">คำขอเข้าพัก</button>
        <button className={view === "transitions" ? "active" : ""} onClick={() => selectView("transitions")} type="button">ประวัติย้ายออก/ย้ายห้อง</button>
      </div>
      {view === "pending" ? <PendingTenantApprovals onChanged={onChanged} propertyId={propertyId} readOnly={readOnly} /> : view === "transitions" ? <TransitionHistory propertyId={propertyId} /> : <>
      <article className="figma-table-card">
        <div className="additional-card-head">
          <div><h2>รายชื่อผู้เช่าปัจจุบัน</h2><p>ข้อมูลผู้เช่า ห้องพัก สัญญา และสถานะการเข้าพัก</p></div>
          <a className="secondary-button" download href={`/api/v1/admin/properties/${propertyId}/exports/tenants?query=${encodeURIComponent(query.trim())}`}><Download size={16} /> ส่งออก CSV</a>
        </div>
        {loadError ? <p className="form-alert error" role="alert">{loadError}</p> : null}
        <div className="figma-table-toolbar">
          <div><Search size={16} /><input aria-label="ค้นหาผู้เช่า" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ ห้อง หรือเบอร์โทร..." value={query} /></div>
        </div>
        <div className="figma-table tenant-table">
          <div className="figma-table-head"><span>ผู้เช่า</span><span>ห้อง</span><span>เบอร์โทร</span><span>ค่าเช่า</span><span>สัญญา</span><span>สถานะ</span><span>จัดการ</span></div>
          {tenants.map((tenant) => {
            const displayStatus = tenant.leaseStatus && tenant.contractEnd
              ? leaseDisplayStatus(tenant.leaseStatus, tenant.contractEnd)
              : tenant.leaseStatus;
            return <button className="figma-table-row" key={tenant.id} onClick={() => {
              setSelectedRoomId(tenant.roomId);
              onOpenTenantDetail(tenant);
            }} type="button">
              <span className="tenant-name-cell">{tenant.name}</span>
              <span>{tenant.roomId}</span>
              <span className="muted-cell">{tenant.phone}</span>
              <span>{tenant.monthlyRent === undefined ? "ไม่มีข้อมูล" : currency.format(tenant.monthlyRent)}</span>
              <span className="muted-cell">{tenant.leaseNumber ? `${tenant.startDate} – ${tenant.contractEnd}` : "ยังไม่มีสัญญา"}</span>
              <span><em className={`figma-status ${displayStatus === "ACTIVE" ? "normal" : displayStatus === "EXPIRING" ? "warning" : ""}`}>{displayStatus ? leaseStatusText[displayStatus] : "ไม่มีสัญญา"}</em></span>
              <span><b className="figma-row-action">ดูข้อมูล</b></span>
            </button>;
          })}
        </div>
        {!isLoading && !loadError && tenants.length === 0 && query.trim() ? (
          <SearchEmptyState description="ลองใช้ชื่อ เลขห้อง หรือเบอร์โทรอื่น" title="ไม่พบผู้เช่าที่ค้นหา" />
        ) : !isLoading && !loadError && tenants.length === 0 ? <p className="settings-empty-list">ยังไม่มีผู้เช่า</p> : null}
        <ServerTablePagination currentItemCount={tenants.length} disabled={isLoading} onPageChange={(nextPage) => void loadTenants(nextPage)} pageInfo={pageInfo} />
      </article>
      </>}
    </section>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Transition Row” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type TransitionRow = {
  id: string; type: "MOVE_OUT" | "MOVE_ROOM"; tenantName: string; effectiveDate: string; reason: string;
  depositAmount: number; outstandingAmount: number; refundAmount: number; amountDue: number; transferredAmount: number;
  sourceRoom: { number: string }; destinationRoom: { number: string } | null; completedBy: { displayName: string };
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Transition History” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { propertyId }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TransitionHistory({ propertyId }: { propertyId: string }) {
  const [rows, setRows] = useState<TransitionRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { page, pageItems, setPage, totalPages } = useTablePagination(rows);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/v1/admin/properties/${propertyId}/occupancy-transitions`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { data?: TransitionRow[]; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error || "โหลดประวัติไม่สำเร็จ");
        setRows(payload.data);
      })
      .catch((loadError) => { if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "โหลดประวัติไม่สำเร็จ"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [propertyId]);
  if (loading) return <p className="form-alert">กำลังโหลดประวัติ...</p>;
  if (error) return <p className="form-alert error" role="alert">{error}</p>;
  return <article className="figma-table-card">
    <div className="additional-card-head"><div><h2>ประวัติการเปลี่ยนห้องและย้ายออก</h2><p>ตรวจสอบวันที่ ยอดเงินประกัน และผู้ดำเนินการย้อนหลัง</p></div></div>
    {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>ผู้เช่า</th><th>รายการ</th><th>วันที่มีผล</th><th>เงินประกัน</th><th>ยอดสรุป</th><th>ผู้ดำเนินการ</th></tr></thead><tbody>{pageItems.map((row) => <tr key={row.id}><td><strong>{row.tenantName}</strong><small className="block opacity-60">{row.reason}</small></td><td>{row.type === "MOVE_ROOM" ? `ย้าย ${row.sourceRoom.number} → ${row.destinationRoom?.number}` : `ย้ายออกจาก ${row.sourceRoom.number}`}</td><td>{new Date(row.effectiveDate).toLocaleDateString("th-TH")}</td><td>{currency.format(row.depositAmount)}</td><td>{row.type === "MOVE_ROOM" ? `โอน ${currency.format(row.transferredAmount)}` : row.refundAmount > 0 ? `คืน ${currency.format(row.refundAmount)}` : `เรียกเพิ่ม ${currency.format(row.amountDue)}`}<small className="block opacity-60">บิลค้าง {currency.format(row.outstandingAmount)}</small></td><td>{row.completedBy.displayName}</td></tr>)}</tbody></table></div> : <p className="settings-empty-list">ยังไม่มีประวัติการย้ายออกหรือย้ายห้อง</p>}
    <TablePagination page={page} setPage={setPage} totalItems={rows.length} totalPages={totalPages} />
  </article>;
}

const leaseStatusText: Record<NonNullable<Tenant["leaseStatus"]>, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_SIGNATURE: "รอลงนาม",
  ACTIVE: "ใช้งาน",
  EXPIRING: "ใกล้หมดอายุ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Summary” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { icon, label, tone, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Summary({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: string }) {
  return <article className={`figma-summary-card tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
