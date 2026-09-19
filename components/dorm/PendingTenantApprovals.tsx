"use client";
// โหลดคำขอและส่งผลตรวจสอบจากเบราว์เซอร์

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, LoaderCircle, RefreshCw, Search, UserCheck, UserX } from "lucide-react";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { IconButton } from "@/components/ui/IconButton";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { useActionFeedback } from "@/lib/client/use-action-feedback";
import { formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";

// คำขอเข้าพักหนึ่งรายการที่ยังรอเจ้าของหอตรวจ
type PendingOccupancy = {
  id: string;
  // ผู้เช่าหลักคือคนที่ชื่ออยู่บนสัญญา ผู้พักร่วมคือคนที่อยู่ด้วยในห้องเดียวกัน
  role: "PRIMARY" | "CO_OCCUPANT";
  status: "PENDING";
  createdAt: string;
  room: { id: string; number: string };
  tenantProfile: {
    phone: string;
    user: { displayName: string; email: string };
  };
};

// ห่อ readApiData ไว้ให้ข้อความผิดพลาดของทั้งไฟล์นี้เหมือนกันหมด
async function parseResponse<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

// ตารางคำขอเข้าพักที่รออนุมัติ พร้อมปุ่มอนุมัติและปฏิเสธ
export function PendingTenantApprovals({
  // เรียกหลังอนุมัติหรือปฏิเสธ ให้หน้าแม่โหลดตัวเลขสรุปใหม่
  onChanged,
  propertyId,
  readOnly = false,
}: {
  onChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
}) {
  const [requests, setRequests] = useState<PendingOccupancy[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [serverPage, setServerPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  // เก็บ id ของแถวที่กำลังตรวจอยู่ ไม่ใช่แค่ true/false เพราะต้องรู้ว่าแถวไหน
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const actionFeedback = useActionFeedback();
  const { confirm, confirmationDialog } = useConfirmation();

  // append = กดโหลดเพิ่ม เอามาต่อท้าย ไม่ใช่โหลดใหม่ทั้งชุด
  const loadRequests = useCallback(async (targetPage = 1, append = false, signal?: AbortSignal) => {
    // แยกสถานะโหลดสองตัว กันรายการที่ดูอยู่หายไปตอนกดโหลดเพิ่ม
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/occupancies?page=${targetPage}&pageSize=50`, {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      const payload = await readApiPayload<{
        data?: PendingOccupancy[];
        error?: string;
        requestId?: string;
        pageInfo?: { page: number; hasNextPage: boolean };
      }>(response, "โหลดคำขอเข้าพักไม่สำเร็จ");
      // ตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้ ต้องดักไว้ก่อน
      if (!payload.data || !payload.pageInfo) throw new Error("ข้อมูลคำขอเข้าพักที่ได้รับไม่ครบถ้วน");
      setRequests((current) => append ? [...current, ...payload.data!] : payload.data!);
      setServerPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
    } catch (loadError) {
      // ยกเลิกเองตอนออกจากหน้า ไม่ใช่ข้อผิดพลาดจริง ไม่ต้องขึ้นเตือนให้ผู้ใช้ตกใจ
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(formatClientError(loadError, "โหลดคำขอเข้าพักไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [propertyId]);

  // ยกเลิกคำขอตอนออกจากหน้า กันไปตั้ง state ของคอมโพเนนต์ที่ถูกถอดไปแล้ว
  useEffect(() => {
    const controller = new AbortController();
    void loadRequests(1, false, controller.signal);
    return () => controller.abort();
  }, [loadRequests]);

  // กรองในเครื่อง ไม่ยิงถามเซิร์ฟเวอร์ เพราะคำขอที่รออยู่มักมีไม่กี่รายการ
  const visibleRequests = useMemo(() => {
    // toLocaleLowerCase("th") เพื่อให้เทียบตัวพิมพ์ใหญ่เล็กถูกตามกฎภาษาไทย
    const normalized = query.trim().toLocaleLowerCase("th");
    if (!normalized) return requests;
    // ค้นได้หลายช่องพร้อมกัน พิมพ์เลขห้องหรือชื่อหรืออีเมลก็เจอ
    return requests.filter((request) => [
      request.room.number,
      request.tenantProfile.user.displayName,
      request.tenantProfile.user.email,
      request.tenantProfile.phone,
    ].some((value) => value.toLocaleLowerCase("th").includes(normalized)));
  }, [query, requests]);
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleRequests);

  // อนุมัติหรือปฏิเสธคำขอ ทั้งสองอย่างใช้ทางเดียวกัน ต่างแค่ค่า status
  const review = async (request: PendingOccupancy, status: "ACTIVE" | "REJECTED") => {
    const action = status === "ACTIVE" ? "อนุมัติ" : "ปฏิเสธ";
    // ถามยืนยันก่อน เพราะอนุมัติแล้วผู้เช่าเข้าระบบได้ทันที และปฏิเสธแล้วย้อนไม่ได้
    if (!await confirm({ title: `${action}คำขอเข้าพัก?`, description: `${request.tenantProfile.user.displayName} · ห้อง ${request.room.number}`, confirmLabel: action, variant: status === "REJECTED" ? "danger" : "default" })) return;
    // เช็คอีกรอบหลังกดยืนยัน เพราะระหว่างที่กล่องเปิดอยู่อาจมีอีกแถวเริ่มทำงานไปแล้ว
    if (reviewingId || actionFeedback.isPending) return;
    setReviewingId(request.id);
    setError("");
    try {
      await actionFeedback.runAction(async () => {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/occupancies/${request.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await parseResponse(response);
      // โหลดตารางใหม่พร้อมบอกหน้าแม่ ทำพร้อมกันได้เพราะไม่ต้องรอผลของกันและกัน
      await Promise.all([loadRequests(1), onChanged()]);
      }, { pending: `กำลัง${action}คำขอเข้าพัก...`, success: `${action}คำขอเข้าพักแล้ว`, error: `${action}คำขอเข้าพักไม่สำเร็จ` });
    } catch (reviewError) {
      setError(formatClientError(reviewError, "ตรวจสอบคำขอไม่สำเร็จ"));
    } finally {
      setReviewingId(null);
    }
  };

  return <>
    <LiveAnnouncement message={actionFeedback.announcement} />
    {/* นับจากข้อมูลที่โหลดมาแล้ว ไม่ได้ถามเซิร์ฟเวอร์เพิ่ม */}
    <div className="figma-summary-grid three">
      <ApprovalSummary label="คำขอที่รอตรวจสอบ" value={`${requests.length}`} />
      <ApprovalSummary label="ผู้เช่าหลัก" value={`${requests.filter((request) => request.role === "PRIMARY").length}`} />
      <ApprovalSummary label="ผู้พักร่วม" value={`${requests.filter((request) => request.role === "CO_OCCUPANT").length}`} />
    </div>

    {error ? <div className="form-alert error" role="alert">{error}</div> : null}
    {readOnly ? <ReadOnlyNotice>ค้นหาและตรวจสอบคำขอเข้าพักได้ แต่ไม่สามารถอนุมัติหรือปฏิเสธคำขอได้</ReadOnlyNotice> : null}

    <article className="figma-table-card">
      <div className="additional-card-head">
        <div><h2>คำขอเข้าพัก</h2><p>ตรวจสอบข้อมูลผู้สมัครก่อนอนุมัติหรือปฏิเสธคำขอ</p></div>
        <IconButton disabled={isLoading || isLoadingMore} label="โหลดคำขอใหม่" onClick={() => void loadRequests(1)}><RefreshCw size={16} /></IconButton>
      </div>
      <div className="figma-table-toolbar">
        <div><Search size={16} /><input aria-label="ค้นหาคำขอเข้าพัก" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือห้อง..." value={query} /></div>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={4} label="กำลังโหลดคำขอเข้าพัก" variant="table" />
      // ว่างเพราะค้นไม่เจอ กับว่างเพราะไม่มีคำขอเลย ต้องบอกคนละแบบ
      ) : pageItems.length === 0 && query.trim() ? (
        <SearchEmptyState description="ลองใช้ชื่อ อีเมล เบอร์โทร หรือเลขห้องอื่น" title="ไม่พบคำขอที่ค้นหา" />
      ) : pageItems.length === 0 ? (
        <div className="document-editor-state"><Clock3 /><p>ไม่มีคำขอเข้าพักที่รอตรวจสอบ</p></div>
      ) : (
        <div className="figma-table approval-table">
          <div className="figma-table-head"><span>ผู้สมัคร</span><span>ห้อง</span><span>ประเภท</span><span>อีเมล</span><span>เบอร์โทร</span><span>สมัครเมื่อ</span><span>สถานะ</span><span>จัดการ</span></div>
          {pageItems.map((request) => (
            <div className="figma-table-row" key={request.id}>
              <span className="tenant-name-cell">{request.tenantProfile.user.displayName}</span>
              <span>{request.room.number}</span>
              <span>{request.role === "PRIMARY" ? "ผู้เช่าหลัก" : "ผู้พักร่วม"}</span>
              <span className="muted-cell">{request.tenantProfile.user.email}</span>
              <span>{request.tenantProfile.phone}</span>
              <span className="muted-cell">{new Date(request.createdAt).toLocaleString("th-TH")}</span>
              <span><em className="figma-status warning">รอตรวจสอบ</em></span>
              <span className="contract-actions">
                {/* ซ่อนปุ่มจัดการทั้งหมดในโหมดอ่านอย่างเดียว ไม่ใช่แค่ทำให้กดไม่ได้ */}
                {!readOnly ? <span className="icon-button-group">
                  {/* ใส่ชื่อผู้สมัครใน label เพราะทุกแถวมีปุ่มหน้าตาเหมือนกันหมด */}
                  <IconButton disabled={reviewingId !== null} label={`อนุมัติ ${request.tenantProfile.user.displayName}`} onClick={() => void review(request, "ACTIVE")} tooltip="อนุมัติ"><UserCheck size={17} /></IconButton>
                  <IconButton disabled={reviewingId !== null} label={`ปฏิเสธ ${request.tenantProfile.user.displayName}`} onClick={() => void review(request, "REJECTED")} tooltip="ปฏิเสธ" variant="danger"><UserX size={17} /></IconButton>
                </span> : null}
                {reviewingId === request.id ? <Check className="animate-pulse" size={16} /> : null}
              </span>
            </div>
          ))}
        </div>
      )}
      <TablePagination page={page} setPage={setPage} totalItems={visibleRequests.length} totalPages={totalPages} />
      {hasNextPage ? <div className="p-4 text-center">
        <button className="secondary-button" disabled={isLoadingMore} onClick={() => void loadRequests(serverPage + 1, true)} type="button">
          {isLoadingMore ? <><LoaderCircle className="animate-spin" size={17} /> กำลังโหลด...</> : "โหลดคำขอเพิ่มเติม"}
        </button>
      </div> : null}
    </article>
    {confirmationDialog}
  </>;
}

// การ์ดตัวเลขสรุปเล็ก ๆ ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function ApprovalSummary({ label, value }: { label: string; value: string }) {
  return <article className="figma-summary-card compact"><div><small>{label}</small><strong>{value}</strong></div></article>;
}
