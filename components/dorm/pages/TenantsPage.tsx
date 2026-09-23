"use client";
// เก็บคำค้นกับแท็บที่เลือก และโหลดข้อมูลทีละหน้าจากเบราว์เซอร์

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarClock, Download, FileText, Search, UsersRound } from "lucide-react";
import { currency } from "@/lib/dorm-utils";
import type { Tenant } from "@/types/dorm";
import { ServerTablePagination, TablePagination, type ServerPageInfo, useTablePagination } from "@/components/dorm/TablePagination";
import { createApiError, formatClientError } from "@/lib/client/api-error";
import { PendingTenantApprovals } from "@/components/dorm/PendingTenantApprovals";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { PageHeaderActions } from "@/components/ui/PageHeaderSlot";
import { LEASE_EXPIRY_NOTICE_DAYS, daysUntilLeaseExpiry, leaseDisplayStatus } from "@/lib/domain/lease-expiry";

// หน้าผู้เช่า มีสามแท็บ ผู้เช่าปัจจุบัน คำขอเข้าพัก และประวัติการย้าย
export function TenantsPage({
  filteredTenants,
  initialPageInfo = null,
  initialPendingRequests = null,
  onChanged,
  onOpenTenantDetail,
  propertyId,
  readOnly = false,
  setSelectedRoomId,
}: {
  filteredTenants: Tenant[];
  // ส่งมาจาก Server Component ของหน้านี้ มีแล้วก็ไม่ต้องยิงซ้ำตอนเปิดหน้า
  initialPageInfo?: ServerPageInfo | null;
  // ส่งต่อให้แท็บคำขอเข้าพัก
  initialPendingRequests?: Parameters<typeof PendingTenantApprovals>[0]["initialRequests"];
  onChanged: () => Promise<void>;
  onOpenTenantDetail: (tenant: Tenant) => void;
  propertyId: string;
  readOnly?: boolean;
  setSelectedRoomId: (roomId: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // เก็บแท็บไว้ใน URL เพื่อให้กดรีเฟรชหรือแชร์ลิงก์แล้วยังอยู่แท็บเดิม
  const requestedView = searchParams.get("tab");
  // ค่าที่ไม่รู้จักใน URL ก็ถอยไปแท็บแรก ไม่เชื่อค่าที่ผู้ใช้พิมพ์เอง
  const initialView = requestedView === "pending" || requestedView === "transitions" ? requestedView : "active";
  const [view, setView] = useState<"active" | "pending" | "transitions">(initialView);
  // ข้อมูลจากเซิร์ฟเวอร์ใช้ได้แค่ตอนเปิดหน้าครั้งแรก ออกจากแท็บแล้วกลับมาให้โหลดใหม่ กันข้อมูลค้าง
  const [pendingSeed, setPendingSeed] = useState(initialView === "pending" ? initialPendingRequests : null);
  const [query, setQuery] = useState("");
  const [tenants, setTenants] = useState(filteredTenants);
  const [pageInfo, setPageInfo] = useState<ServerPageInfo>(initialPageInfo ?? { page: 1, pageSize: 20, hasNextPage: false });
  const skipInitialLoadRef = useRef(initialPageInfo !== null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadTenants = useCallback(async (targetPage = 1, signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      // ส่งคำค้นไปให้เซิร์ฟเวอร์ ไม่ได้กรองในเครื่อง เพราะผู้เช่าทั้งหอมีเยอะเกินจะโหลดมาหมด
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tenants?page=${targetPage}&pageSize=20&query=${encodeURIComponent(query.trim())}`, {
        cache: "no-store", signal,
      });
      const payload = await response.json() as {
        data?: Tenant[];
        error?: string;
        requestId?: string;
        pageInfo?: ServerPageInfo;
      };
      // เช็คทั้งสถานะและตัวข้อมูล เพราะตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้
      if (!response.ok || !payload.data || !payload.pageInfo) throw createApiError(payload, "โหลดข้อมูลผู้เช่าไม่สำเร็จ");
      setTenants(payload.data);
      setPageInfo(payload.pageInfo);
    } catch (error) {
      // ยกเลิกเองตอนผู้ใช้พิมพ์ต่อ ไม่ใช่ข้อผิดพลาดจริง ไม่ต้องขึ้นเตือนให้ตกใจ
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(formatClientError(error, "โหลดข้อมูลผู้เช่าไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, query]);

  useEffect(() => {
    // เซิร์ฟเวอร์ส่งหน้าแรกมาแล้ว รอบแรกจึงข้ามไป
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    const controller = new AbortController();
    // หน่วง 250 มิลลิวินาทีหลังหยุดพิมพ์ จะได้ไม่ยิงทุกครั้งที่กดแป้น
    // ส่วน abort ยกเลิกคำขอเก่า กันผลเก่ามาถึงทีหลังแล้วทับผลใหม่
    const timeout = window.setTimeout(() => void loadTenants(1, controller.signal), 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [loadTenants]);

  // ตามการกดปุ่มย้อนกลับของเบราว์เซอร์ด้วย เพราะ URL เปลี่ยนได้โดยไม่ผ่าน selectView
  useEffect(() => {
    setView(requestedView === "pending" || requestedView === "transitions" ? requestedView : "active");
  }, [requestedView]);

  useEffect(() => {
    if (view !== "pending") setPendingSeed(null);
  }, [view]);

  // เปลี่ยนแท็บพร้อมอัปเดต URL ให้ตรงกัน
  const selectView = (nextView: "active" | "pending" | "transitions") => {
    setView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    // แท็บแรกไม่ต้องใส่ใน URL ให้ลิงก์สั้นและสะอาด
    if (nextView === "active") params.delete("tab");
    else params.set("tab", nextView);
    const queryString = params.toString();
    // replace ไม่ใช่ push เพราะสลับแท็บไม่ควรไปสะสมในประวัติของปุ่มย้อนกลับ
    // scroll: false กันหน้าเด้งกลับไปบนสุดทุกครั้งที่สลับ
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  };

  // นับจากข้อมูลของหน้าที่โหลดมาแล้ว จึงเป็นตัวเลขของหน้านี้ ไม่ใช่ทั้งหอ
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
      {view === "pending" ? <PendingTenantApprovals initialRequests={pendingSeed} onChanged={onChanged} propertyId={propertyId} readOnly={readOnly} /> : view === "transitions" ? <TransitionHistory propertyId={propertyId} /> : <>
      {/* ส่งปุ่มส่งออกขึ้นไปแสดงบนแถบหัวเรื่องของ shell แทนที่จะอยู่ในหน้า */}
      <PageHeaderActions><a className="secondary-button" download href={`/api/v1/admin/properties/${propertyId}/exports/tenants?query=${encodeURIComponent(query.trim())}`}><Download size={16} /> ส่งออก CSV</a></PageHeaderActions>
      <article className="figma-table-card">
        {loadError ? <p className="form-alert error" role="alert">{loadError}</p> : null}
        <div className="figma-table-toolbar">
          <div><Search size={16} /><input aria-label="ค้นหาผู้เช่า" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ ห้อง หรือเบอร์โทร..." value={query} /></div>
        </div>
        <div className="figma-table-wrap">
          <table className="figma-table tenant-table">
            <thead>
              <tr className="figma-table-head"><th scope="col">ผู้เช่า</th><th scope="col">ห้อง</th><th scope="col">เบอร์โทร</th><th scope="col">ค่าเช่า</th><th scope="col">สัญญา</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                // สัญญาที่ยังใช้งานอยู่แต่ใกล้หมดอายุ ต้องแสดงเป็น "ใกล้หมดอายุ" ไม่ใช่ "ใช้งาน"
                // ฐานข้อมูลยังเก็บเป็น ACTIVE อยู่ จึงต้องคำนวณตอนแสดงผลเอง
                const displayStatus = tenant.leaseStatus && tenant.contractEnd
                  ? leaseDisplayStatus(tenant.leaseStatus, tenant.contractEnd)
                  : tenant.leaseStatus;
                const openDetail = () => {
                  setSelectedRoomId(tenant.roomId);
                  onOpenTenantDetail(tenant);
                };
                // กดตรงไหนของแถวก็เปิดรายละเอียดได้ ไม่ต้องเล็งปุ่มเล็ก ๆ ท้ายแถว
                // ส่วนคนที่ใช้คีย์บอร์ดกดที่ปุ่มท้ายแถว ซึ่งมีชื่อกำกับว่าเป็นของใคร
                return <tr className="figma-table-row" key={tenant.id} onClick={openDetail}>
                  <td className="tenant-name-cell">{tenant.name}</td>
                  <td>{tenant.roomId}</td>
                  <td className="muted-cell">{tenant.phone}</td>
                  <td>{tenant.monthlyRent === undefined ? "ไม่มีข้อมูล" : currency.format(tenant.monthlyRent)}</td>
                  <td className="muted-cell">{tenant.leaseNumber ? `${tenant.startDate} – ${tenant.contractEnd}` : "ยังไม่มีสัญญา"}</td>
                  <td><em className={`figma-status ${displayStatus === "ACTIVE" ? "normal" : displayStatus === "EXPIRING" ? "warning" : ""}`}>{displayStatus ? leaseStatusText[displayStatus] : "ไม่มีสัญญา"}</em></td>
                  <td><button aria-label={`ดูข้อมูล ${tenant.name} ${tenant.roomId}`} className="figma-row-action" onClick={openDetail} type="button">ดูข้อมูล</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {/* ว่างเพราะค้นไม่เจอ กับว่างเพราะยังไม่มีผู้เช่า ต้องบอกคนละแบบ */}
        {!isLoading && !loadError && tenants.length === 0 && query.trim() ? (
          <SearchEmptyState description="ลองใช้ชื่อ เลขห้อง หรือเบอร์โทรอื่น" title="ไม่พบผู้เช่าที่ค้นหา" />
        ) : !isLoading && !loadError && tenants.length === 0 ? <p className="settings-empty-list">ยังไม่มีผู้เช่า</p> : null}
        <ServerTablePagination currentItemCount={tenants.length} disabled={isLoading} onPageChange={(nextPage) => void loadTenants(nextPage)} pageInfo={pageInfo} />
      </article>
      </>}
    </section>
  );
}

// หนึ่งรายการในประวัติการย้าย ย้ายห้องจะมีห้องปลายทาง ย้ายออกไม่มี
type TransitionRow = {
  id: string; type: "MOVE_OUT" | "MOVE_ROOM"; tenantName: string; effectiveDate: string; reason: string;
  depositAmount: number; outstandingAmount: number; refundAmount: number; amountDue: number; transferredAmount: number;
  sourceRoom: { number: string }; destinationRoom: { number: string } | null; completedBy: { displayName: string };
};

// แท็บประวัติการย้าย โหลดข้อมูลของตัวเองแยกต่างหาก ใช้แค่ในไฟล์นี้
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
      // ยกเลิกเองตอนออกจากแท็บ ไม่ใช่ข้อผิดพลาดจริง
      .catch((loadError) => { if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "โหลดประวัติไม่สำเร็จ"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [propertyId]);
  // แยกสามสถานะให้ชัด กำลังโหลด โหลดพลาด และมีข้อมูลแล้ว
  if (loading) return <p className="form-alert">กำลังโหลดประวัติ...</p>;
  if (error) return <p className="form-alert error" role="alert">{error}</p>;
  return <article className="figma-table-card">
    <div className="additional-card-head"><div><h2>ประวัติการเปลี่ยนห้องและย้ายออก</h2><p>ตรวจสอบวันที่ ยอดเงินประกัน และผู้ดำเนินการย้อนหลัง</p></div></div>
    {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>ผู้เช่า</th><th>รายการ</th><th>วันที่มีผล</th><th>เงินประกัน</th><th>ยอดสรุป</th><th>ผู้ดำเนินการ</th></tr></thead><tbody>{pageItems.map((row) => <tr key={row.id}><td><strong>{row.tenantName}</strong><small className="block opacity-60">{row.reason}</small></td><td>{row.type === "MOVE_ROOM" ? `ย้าย ${row.sourceRoom.number} → ${row.destinationRoom?.number}` : `ย้ายออกจาก ${row.sourceRoom.number}`}</td><td>{new Date(row.effectiveDate).toLocaleDateString("th-TH")}</td><td>{currency.format(row.depositAmount)}</td><td>{row.type === "MOVE_ROOM" ? `โอน ${currency.format(row.transferredAmount)}` : row.refundAmount > 0 ? `คืน ${currency.format(row.refundAmount)}` : `เรียกเพิ่ม ${currency.format(row.amountDue)}`}<small className="block opacity-60">บิลค้าง {currency.format(row.outstandingAmount)}</small></td><td>{row.completedBy.displayName}</td></tr>)}</tbody></table></div> : <p className="settings-empty-list">ยังไม่มีประวัติการย้ายออกหรือย้ายห้อง</p>}
    <TablePagination page={page} setPage={setPage} totalItems={rows.length} totalPages={totalPages} />
  </article>;
}

// Record บังคับให้ครอบคลุมทุกสถานะตั้งแต่ตอนคอมไพล์ เพิ่มสถานะใหม่แล้วลืมแปลจะคอมไพล์ไม่ผ่าน
const leaseStatusText: Record<NonNullable<Tenant["leaseStatus"]>, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_SIGNATURE: "รอลงนาม",
  ACTIVE: "ใช้งาน",
  EXPIRING: "ใกล้หมดอายุ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
};

// การ์ดตัวเลขสรุปด้านบน ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function Summary({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: string }) {
  return <article className={`figma-summary-card tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
