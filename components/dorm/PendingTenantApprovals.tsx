"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Pending Tenant Approvals” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Pending Occupancy” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type PendingOccupancy = {
  id: string;
  role: "PRIMARY" | "CO_OCCUPANT";
  status: "PENDING";
  createdAt: string;
  room: { id: string; number: string };
  tenantProfile: {
    phone: string;
    user: { displayName: string; email: string };
  };
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Response” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
async function parseResponse<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Pending Tenant Approvals” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { onChanged, propertyId, readOnly = false, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function PendingTenantApprovals({
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
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const actionFeedback = useActionFeedback();
  const { confirm, confirmationDialog } = useConfirmation();

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Requests” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - signal: ค่า “signal” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadRequests = useCallback(async (targetPage = 1, append = false, signal?: AbortSignal) => {
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
      if (!payload.data || !payload.pageInfo) throw new Error("ข้อมูลคำขอเข้าพักที่ได้รับไม่ครบถ้วน");
      setRequests((current) => append ? [...current, ...payload.data!] : payload.data!);
      setServerPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(formatClientError(loadError, "โหลดคำขอเข้าพักไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [propertyId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRequests(1, false, controller.signal);
    return () => controller.abort();
  }, [loadRequests]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “visible Requests” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const visibleRequests = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    if (!normalized) return requests;
    return requests.filter((request) => [
      request.room.number,
      request.tenantProfile.user.displayName,
      request.tenantProfile.user.email,
      request.tenantProfile.phone,
    ].some((value) => value.toLocaleLowerCase("th").includes(normalized)));
  }, [query, requests]);
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleRequests);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “review” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
   * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const review = async (request: PendingOccupancy, status: "ACTIVE" | "REJECTED") => {
    const action = status === "ACTIVE" ? "อนุมัติ" : "ปฏิเสธ";
    if (!await confirm({ title: `${action}คำขอเข้าพัก?`, description: `${request.tenantProfile.user.displayName} · ห้อง ${request.room.number}`, confirmLabel: action, variant: status === "REJECTED" ? "danger" : "default" })) return;
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
                {!readOnly ? <>
                  <IconButton disabled={reviewingId !== null} label={`อนุมัติ ${request.tenantProfile.user.displayName}`} onClick={() => void review(request, "ACTIVE")} tooltip="อนุมัติ"><UserCheck size={17} /></IconButton>
                  <IconButton disabled={reviewingId !== null} label={`ปฏิเสธ ${request.tenantProfile.user.displayName}`} onClick={() => void review(request, "REJECTED")} tooltip="ปฏิเสธ" variant="danger"><UserX size={17} /></IconButton>
                </> : null}
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Approval Summary” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function ApprovalSummary({ label, value }: { label: string; value: string }) {
  return <article className="figma-summary-card compact"><div><small>{label}</small><strong>{value}</strong></div></article>;
}
