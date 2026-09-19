"use client";
// โหลดรายการและส่งผลตรวจสอบจากเบราว์เซอร์

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, ExternalLink, FileWarning, LoaderCircle, ReceiptText, RefreshCw, Search, X, XCircle } from "lucide-react";
import type { PaymentSubmissionStatus } from "@/lib/domain/enums";
import { currency } from "@/lib/dorm-utils";
import { DropdownField } from "@/components/dorm/DropdownField";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { useActionFeedback } from "@/lib/client/use-action-feedback";
import { formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";

// หลักฐานการโอนที่ผู้เช่าส่งมาหนึ่งรายการ
type PaymentSubmission = {
  id: string;
  // จำนวนเงินเป็นสตริงเพราะฝั่งเซิร์ฟเวอร์ใช้ Decimal ส่งเป็น number ตรง ๆ จะปัดเศษเพี้ยน
  amount: string;
  status: PaymentSubmissionStatus;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionNote: string | null;
  // ไฟล์สลิปมีวันหมดอายุ ตัวนี้บอกว่ายังเปิดดูได้อยู่หรือเปล่า
  slipAvailable: boolean;
  invoice: {
    id: string;
    invoiceNumber: string;
    total: string;
    room: { number: string };
  };
  tenantProfile: { user: { displayName: string } };
};

// Record บังคับให้ครอบคลุมทุกสถานะตั้งแต่ตอนคอมไพล์ เพิ่มสถานะใหม่แล้วลืมแปลจะคอมไพล์ไม่ผ่าน
const statusLabels: Record<PaymentSubmissionStatus, string> = {
  PENDING_REVIEW: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
};

// ห่อ readApiData ไว้ให้ข้อความผิดพลาดของทั้งไฟล์นี้เหมือนกันหมด
async function parseResponse<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

// หน้าตรวจหลักฐานการชำระ ซ้ายเป็นคิวรายการ ขวาเป็นสลิปกับปุ่มอนุมัติหรือปฏิเสธ
export function PaymentReviewPanel({
  initialPayments = null,
  onChanged,
  propertyId,
  readOnly = false,
}: {
  // ส่งมาจาก Server Component ของหน้านี้ มีแล้วก็ไม่ต้องยิงซ้ำตอนเปิดแท็บ
  initialPayments?: { data: PaymentSubmission[]; hasNextPage: boolean } | null;
  onChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
}) {
  const [payments, setPayments] = useState<PaymentSubmission[]>(initialPayments?.data ?? []);
  // ข้อมูลที่ส่งมาเป็นชุดของสถานะรอตรวจสอบหน้าแรก ตรงกับที่ effect จะยิงรอบแรกพอดี จึงข้ามรอบนั้นได้
  const skipInitialLoadRef = useRef(initialPayments !== null);
  // เปิดมาที่รอตรวจสอบก่อน เพราะเป็นงานที่ต้องทำ ส่วนที่ตรวจไปแล้วไว้ดูย้อนหลัง
  const [status, setStatus] = useState<PaymentSubmissionStatus | "ALL">("PENDING_REVIEW");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(initialPayments === null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [serverPage, setServerPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(initialPayments?.hasNextPage ?? false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const actionFeedback = useActionFeedback();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PaymentSubmission | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const { confirm, confirmationDialog } = useConfirmation();

  // append = กดโหลดเพิ่ม เอามาต่อท้าย ไม่ใช่โหลดใหม่ทั้งชุด
  const loadPayments = useCallback(async (targetPage = 1, append = false, signal?: AbortSignal) => {
    setError("");
    // แยกสถานะโหลดสองตัว กันรายการที่ดูอยู่หายไปตอนกดโหลดเพิ่ม
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const search = new URLSearchParams({ page: String(targetPage), pageSize: "50" });
      // ให้เซิร์ฟเวอร์กรองสถานะ เพราะรายการที่ตรวจไปแล้วสะสมเยอะเกินจะโหลดมาทั้งหมด
      if (status !== "ALL") search.set("status", status);
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/payment-submissions?${search}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      const payload = await readApiPayload<{
        data?: PaymentSubmission[];
        error?: string;
        requestId?: string;
        pageInfo?: { page: number; hasNextPage: boolean };
      }>(response, "โหลดรายการชำระไม่สำเร็จ");
      // ตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้ ต้องดักไว้ก่อน
      if (!payload.data || !payload.pageInfo) throw new Error("ข้อมูลรายการชำระที่ได้รับไม่ครบถ้วน");
      setPayments((current) => append ? [...current, ...payload.data!] : payload.data!);
      setServerPage(payload.pageInfo.page);
      setHasNextPage(payload.pageInfo.hasNextPage);
    } catch (loadError) {
      // ยกเลิกเองตอนเปลี่ยนสถานะหรือออกจากหน้า ไม่ใช่ข้อผิดพลาดจริง
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(formatClientError(loadError, "โหลดรายการชำระไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [propertyId, status]);

  // เปลี่ยนสถานะที่กรองก็โหลดใหม่ พร้อมยกเลิกคำขอเก่าที่ยังค้าง
  useEffect(() => {
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    const controller = new AbortController();
    void loadPayments(1, false, controller.signal);
    return () => controller.abort();
  }, [loadPayments]);

  // กรองคำค้นในเครื่อง ส่วนการกรองสถานะให้เซิร์ฟเวอร์ทำ
  const visiblePayments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    if (!normalized) return payments;
    return payments.filter((payment) => [
      payment.invoice.invoiceNumber,
      payment.invoice.room.number,
      payment.tenantProfile.user.displayName,
    ].some((value) => value.toLocaleLowerCase("th").includes(normalized)));
  }, [payments, query]);
  const { page, pageItems, setPage, totalPages } = useTablePagination(visiblePayments);
  // ตกไปที่รายการแรกของหน้าเมื่อรายการที่เลือกไว้หายไป เช่นเพิ่งตรวจเสร็จแล้วหลุดจากคิว
  // ฝั่งขวาจะได้ไม่ว่างเปล่า ผู้ใช้ตรวจรายการถัดไปต่อได้เลย
  const selectedPayment = visiblePayments.find((payment) => payment.id === selectedPaymentId)
    ?? pageItems[0]
    ?? null;

  // ซิงก์ id ที่เก็บไว้ให้ตรงกับรายการที่แสดงจริง หลังจากตกไปใช้ค่าสำรองข้างบน
  useEffect(() => {
    if (!selectedPayment) {
      setSelectedPaymentId(null);
      return;
    }
    if (selectedPayment.id !== selectedPaymentId) setSelectedPaymentId(selectedPayment.id);
  }, [selectedPayment, selectedPaymentId]);

  // อนุมัติหรือปฏิเสธ ปฏิเสธต้องมีเหตุผลด้วย เพราะผู้เช่าต้องรู้ว่าจะแก้อะไร
  const review = async (payment: PaymentSubmission, nextStatus: "APPROVED" | "REJECTED", note?: string) => {
    // กันกดซ้ำระหว่างรอเซิร์ฟเวอร์ตอบ
    if (reviewingId || actionFeedback.isPending) return;
    setReviewingId(payment.id);
    setError("");
    try {
      const action = nextStatus === "APPROVED" ? "อนุมัติการชำระเงิน" : "ปฏิเสธหลักฐานการชำระเงิน";
      await actionFeedback.runAction(async () => {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/payment-submissions/${payment.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...(nextStatus === "REJECTED" ? { rejectionNote: note } : {}),
        }),
      });
      await parseResponse(response);
      setRejecting(null);
      setRejectionNote("");
      await Promise.all([loadPayments(1), onChanged()]);
      // คืนโฟกัสเฉพาะตอนอนุมัติ เพราะตอนปฏิเสธกล่องกรอกเหตุผลปิดตัวเองและจัดการโฟกัสอยู่แล้ว
      }, { pending: `กำลัง${action}...`, success: `${action}แล้ว`, error: `${action}ไม่สำเร็จ` }, { restoreFocus: nextStatus === "APPROVED" });
    } catch (reviewError) {
      setError(formatClientError(reviewError, "ตรวจสอบรายการไม่สำเร็จ"));
    } finally {
      setReviewingId(null);
    }
  };

  const submitRejection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rejecting) void review(rejecting, "REJECTED", rejectionNote.trim());
  };

  return <>
    <LiveAnnouncement message={actionFeedback.announcement} />
    <div className="figma-summary-grid three">
      <PaymentSummary label="รายการในมุมมอง" value={`${payments.length}`} />
      <PaymentSummary label="ยอดรวมในมุมมอง" value={currency.format(payments.reduce((sum, payment) => sum + Number(payment.amount), 0))} />
      <PaymentSummary label="รอตรวจสอบ" value={`${payments.filter((payment) => payment.status === "PENDING_REVIEW").length}`} />
    </div>

    {error ? <div className="form-alert error" role="alert">{error}</div> : null}

    <article className="payment-review-shell">
      <div className="additional-card-head">
        <div><h2>หลักฐานการชำระเงิน</h2><p>ตรวจสอบสลิปและยืนยันหรือปฏิเสธรายการที่ผู้เช่าส่งมา</p></div>
        <IconButton disabled={isLoading || isLoadingMore} label="โหลดรายการใหม่" onClick={() => void loadPayments(1)}><RefreshCw size={16} /></IconButton>
      </div>
      <div className="figma-table-toolbar">
        <div><Search size={16} /><input aria-label="ค้นหาหลักฐานการชำระ" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขบิล ห้อง หรือผู้เช่า..." value={query} /></div>
        <div className="contract-actions">
          <DropdownField
            label="สถานะ"
            onChange={(value) => setStatus(value as PaymentSubmissionStatus | "ALL")}
            options={[
              { value: "PENDING_REVIEW", label: "รอตรวจสอบ" },
              { value: "APPROVED", label: "อนุมัติแล้ว" },
              { value: "REJECTED", label: "ปฏิเสธ" },
              { value: "ALL", label: "ทุกสถานะ" },
            ]}
            value={status}
          />
        </div>
      </div>

      {/* ว่างเพราะค้นไม่เจอ กับว่างเพราะไม่มีรายการในสถานะนี้ ต้องบอกคนละแบบ */}
      {isLoading ? <div className="payment-review-loading" aria-live="polite"><LoaderCircle className="animate-spin" /> กำลังโหลดหลักฐานการชำระ...</div> : pageItems.length === 0 && query.trim() ? <SearchEmptyState description="ลองใช้เลขบิล เลขห้อง หรือชื่อผู้เช่าอื่น" title="ไม่พบรายการที่ค้นหา" /> : pageItems.length === 0 ? <div className="payment-review-loading"><Clock3 /><p>ไม่มีรายการในสถานะนี้</p></div> : (
        <div className="payment-review-workspace">
          <aside aria-label="คิวหลักฐานการชำระ" className="payment-review-queue">
            <header><div><strong>คิวตรวจสอบ</strong><small>{visiblePayments.length} รายการ</small></div></header>
            <div className="payment-review-list">
              {/* aria-current บอกโปรแกรมอ่านหน้าจอว่ากำลังดูรายการไหน ไม่ใช่แค่ทำให้สีเข้ม */}
              {pageItems.map((payment) => <button
                aria-current={selectedPayment?.id === payment.id ? "true" : undefined}
                className={`payment-review-item ${selectedPayment?.id === payment.id ? "active" : ""}`}
                key={payment.id}
                onClick={() => setSelectedPaymentId(payment.id)}
                type="button"
              >
                <span className="payment-review-item-head"><strong>{payment.invoice.invoiceNumber}</strong><em className={`figma-status ${payment.status === "APPROVED" ? "normal" : payment.status === "PENDING_REVIEW" ? "warning" : ""}`}>{statusLabels[payment.status]}</em></span>
                <span className="payment-review-item-person">ห้อง {payment.invoice.room.number} · {payment.tenantProfile.user.displayName}</span>
                <span className="payment-review-item-meta"><strong>{currency.format(Number(payment.amount))}</strong><time>{new Date(payment.submittedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</time></span>
              </button>)}
            </div>
            <TablePagination page={page} setPage={setPage} totalItems={visiblePayments.length} totalPages={totalPages} />
            {hasNextPage ? <div className="payment-review-load-more"><button className="secondary-button" disabled={isLoadingMore} onClick={() => void loadPayments(serverPage + 1, true)} type="button">{isLoadingMore ? <><LoaderCircle className="animate-spin" size={17} /> กำลังโหลด...</> : "โหลดรายการเพิ่มเติม"}</button></div> : null}
          </aside>

          {selectedPayment ? <PaymentInspectionPane
            onApprove={() => { void confirm({ title: "ยืนยันรับชำระ?", description: `บิล ${selectedPayment.invoice.invoiceNumber} · ${currency.format(Number(selectedPayment.amount))}`, confirmLabel: "ยืนยันรับชำระ" }).then((accepted) => { if (accepted) void review(selectedPayment, "APPROVED"); }); }}
            onReject={() => { setRejecting(selectedPayment); setRejectionNote(""); }}
            payment={selectedPayment}
            propertyId={propertyId}
            readOnly={readOnly}
            reviewing={reviewingId !== null}
          /> : null}
        </div>
      )}
    </article>

    {confirmationDialog}
    {/* บังคับกรอกเหตุผล ปุ่มยืนยันจะกดไม่ได้จนกว่าจะพิมพ์ */}
    {rejecting ? (
      <Dialog ariaDescribedBy="reject-payment-description" ariaLabelledBy="reject-payment-title" className="modal-sm" onClose={() => setRejecting(null)}>
          <header className="modal-header">
            <div><h2 id="reject-payment-title">ปฏิเสธหลักฐานการชำระ</h2><p id="reject-payment-description">บิล {rejecting.invoice.invoiceNumber} · ห้อง {rejecting.invoice.room.number}</p></div>
            <IconButton disabled={reviewingId !== null} label="ปิด" onClick={() => setRejecting(null)} tooltip="ปิดหน้าต่างปฏิเสธหลักฐาน"><X /></IconButton>
          </header>
          <form className="modal-form" onSubmit={submitRejection}>
            <label>
              <span>เหตุผลที่ปฏิเสธ</span>
              <textarea autoFocus maxLength={500} minLength={1} onChange={(event) => setRejectionNote(event.target.value)} placeholder="เช่น ยอดเงินไม่ตรง ภาพไม่ชัด หรือไม่พบรายการโอน" required value={rejectionNote} />
            </label>
            <footer className="modal-actions">
              <button disabled={reviewingId !== null} onClick={() => setRejecting(null)} type="button">ยกเลิก</button>
              <button aria-describedby={!reviewingId && !rejectionNote.trim() ? "payment-rejection-disabled-reason" : undefined} className="primary-button danger-confirm-button" disabled={reviewingId !== null || !rejectionNote.trim()} type="submit">{reviewingId ? "กำลังบันทึก..." : "ยืนยันปฏิเสธ"}</button>
            </footer>
            {!reviewingId && !rejectionNote.trim() ? <p className="disabled-reason justify-self-end" id="payment-rejection-disabled-reason">ระบุเหตุผลที่ปฏิเสธหลักฐานก่อนยืนยัน</p> : null}
          </form>
      </Dialog>
    ) : null}
  </>;
}

// ฝั่งขวา แสดงสลิปกับข้อมูลให้เทียบยอด ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function PaymentInspectionPane({ onApprove, onReject, payment, propertyId, readOnly, reviewing }: {
  onApprove: () => void;
  onReject: () => void;
  payment: PaymentSubmission;
  propertyId: string;
  readOnly: boolean;
  reviewing: boolean;
}) {
  // ไฟล์สลิปผ่าน API ที่ตรวจสิทธิ์ก่อน ไม่ได้วางไว้ในโฟลเดอร์สาธารณะให้ใครก็เปิดได้
  const slipUrl = `/api/v1/admin/properties/${propertyId}/payment-submissions/${payment.id}/slip`;
  return <section aria-label={`รายละเอียดการชำระ ${payment.invoice.invoiceNumber}`} className="payment-inspection-pane">
    <header className="payment-inspection-header">
      <div><small>กำลังตรวจสอบ</small><h2>{payment.invoice.invoiceNumber}</h2><p>ห้อง {payment.invoice.room.number} · {payment.tenantProfile.user.displayName}</p></div>
      <em className={`figma-status ${payment.status === "APPROVED" ? "normal" : payment.status === "PENDING_REVIEW" ? "warning" : ""}`}>{statusLabels[payment.status]}</em>
    </header>
    <div className="payment-inspection-facts">
      {/* วางยอดที่แจ้งกับยอดตามบิลติดกัน ผู้ตรวจจะได้เห็นทันทีว่าตรงกันหรือไม่ */}
      <div><span>ยอดที่แจ้งชำระ</span><strong>{currency.format(Number(payment.amount))}</strong></div>
      <div><span>ยอดตามบิล</span><strong>{currency.format(Number(payment.invoice.total))}</strong></div>
      <div><span>ส่งหลักฐานเมื่อ</span><strong>{new Date(payment.submittedAt).toLocaleString("th-TH")}</strong></div>
      <div><span>ตรวจสอบเมื่อ</span><strong>{payment.reviewedAt ? new Date(payment.reviewedAt).toLocaleString("th-TH") : "ยังไม่ได้ตรวจสอบ"}</strong></div>
    </div>
    <div className="payment-slip-toolbar"><strong><ReceiptText size={17} /> หลักฐานการชำระ</strong>{payment.slipAvailable ? <a href={slipUrl} rel="noreferrer" target="_blank"><ExternalLink size={15} /> เปิดหน้าต่างใหม่</a> : null}</div>
    <div className="payment-slip-preview">
      {/* key เป็น id เพื่อบังคับให้ iframe โหลดใหม่ตอนเปลี่ยนรายการ ไม่งั้นจะค้างสลิปเดิม */}
      {payment.slipAvailable ? <iframe key={payment.id} src={slipUrl} title={`หลักฐานการชำระ ${payment.invoice.invoiceNumber}`} /> : <div><FileWarning /><strong>หลักฐานหมดอายุหรือไม่พร้อมใช้งาน</strong><p>ตรวจสอบข้อมูลรายการและติดต่อผู้เช่าหากจำเป็น</p></div>}
    </div>
    {payment.rejectionNote ? <div className="payment-rejection-note"><strong>เหตุผลที่ปฏิเสธ</strong><p>{payment.rejectionNote}</p></div> : null}
    {/* ซ่อนปุ่มเมื่อตรวจไปแล้ว เพราะย้อนกลับไม่ได้ ต้องให้ผู้เช่าส่งหลักฐานใหม่แทน */}
    {payment.status === "PENDING_REVIEW" ? <footer className="payment-inspection-actions">
      {readOnly ? <ReadOnlyNotice compact /> : <><button className="secondary-button destructive-outline-button payment-reject-button" disabled={reviewing} onClick={onReject} type="button"><XCircle size={17} /> ปฏิเสธหลักฐาน</button><button className="primary-button" disabled={reviewing} onClick={onApprove} type="button">{reviewing ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />} ยืนยันรับชำระ</button></>}
    </footer> : null}
  </section>;
}

// การ์ดตัวเลขสรุปเล็ก ๆ ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function PaymentSummary({ label, value }: { label: string; value: string }) {
  return <article className="figma-summary-card compact"><div><small>{label}</small><strong>{value}</strong></div></article>;
}
