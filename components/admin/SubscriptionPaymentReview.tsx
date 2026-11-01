"use client";
// โหลดรายการ เลือกรายการ และส่งผลตรวจสอบจากเบราว์เซอร์

import Image from "next/image";
import { SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Check, Clock3, ExternalLink, FileText, Inbox, Wallet, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { useSuperAdminNotifications } from "@/components/admin/SuperAdminNotifications";
import { createApiError, formatClientError } from "@/lib/client/api-error";
import { ServerTablePagination, type ServerPageInfo } from "@/components/dorm/TablePagination";
import { IconButton } from "@/components/ui/IconButton";
import { Dialog } from "@/components/ui/Dialog";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { SearchSuggestField, type SearchSuggestion } from "@/components/ui/SearchSuggestField";
import { subscriptionPaymentPageSize } from "@/lib/domain/saas";

type PaymentStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type PaymentStatusFilter = PaymentStatus | "ALL";

// หลักฐานการโอนค่าสมาชิกที่เจ้าของหอส่งมา คนละเรื่องกับค่าเช่าที่ผู้เช่าจ่าย
export type Payment = {
  id: string; amount: string; mimeType: string; sizeBytes: number; submittedAt: string;
  status: PaymentStatus; reviewedAt: string | null; rejectionNote: string | null;
  order: { orderNumber: string; propertyId: string; planName: string; billingInterval: "MONTHLY" | "YEARLY"; type: "NEW" | "RENEWAL"; property: { name: string } };
};

export type PaymentSummary = { pending: number; approvedThisMonth: number; approvedAmountThisMonth: string };


const statusFilters: Array<{ value: PaymentStatusFilter; label: string }> = [
  { value: "PENDING_REVIEW", label: "รอตรวจ" },
  { value: "APPROVED", label: "อนุมัติแล้ว" },
  { value: "REJECTED", label: "ปฏิเสธ" },
  { value: "ALL", label: "ทั้งหมด" },
];
const statusLabels: Record<PaymentStatus, string> = { PENDING_REVIEW: "รอตรวจ", APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ" };
const statusBadge: Record<PaymentStatus, string> = { PENDING_REVIEW: "badge-pending", APPROVED: "badge-paid", REJECTED: "badge-rejected" };

const slipUrl = (payment: Payment) => `/api/v1/super-admin/subscription-payments/${payment.id}/slip`;
const formatAmount = (amount: string | number) => `฿${Number(amount).toLocaleString("th-TH")}`;
const intervalLabel = (payment: Payment) => payment.order.billingInterval === "YEARLY" ? "รายปี" : "รายเดือน";

function fileLabel(payment: Payment) {
  const kind = payment.mimeType === "application/pdf" ? "PDF" : payment.mimeType === "image/png" ? "PNG" : "JPG";
  // ไฟล์เล็กกว่า 1 KB บอกเป็นไบต์ ไม่งั้นปัดแล้วกลายเป็น "0 KB" ดูเหมือนไฟล์เสีย
  const size = payment.sizeBytes < 1024
    ? `${payment.sizeBytes.toLocaleString("th-TH")} B`
    : `${(payment.sizeBytes / 1024).toLocaleString("th-TH", { maximumFractionDigits: 0 })} KB`;
  return `${kind} · ${size}`;
}

// ส่งคำค้นไปให้เซิร์ฟเวอร์ ไม่ได้กรองในเครื่อง เพราะเป็นข้อมูลของทุกหอในระบบ
async function fetchPaymentPage(page: number, status: PaymentStatusFilter, query: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(subscriptionPaymentPageSize), status, query: query.trim() });
  const response = await fetch(`/api/v1/super-admin/subscription-payments?${params}`, { cache: "no-store" });
  const payload = await response.json() as { data?: Payment[]; pageInfo?: ServerPageInfo; error?: string };
  if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดรายการไม่สำเร็จ");
  return { data: payload.data, pageInfo: payload.pageInfo };
}

// หน้าตรวจค่าสมาชิกแบบ Google Admin console: การ์ดสรุปด้านบน ชิปกรองสถานะ ตาราง และแผงสลิปด้านขวา
// อนุมัติแล้วระบบเปิดใช้หรือต่ออายุแพ็กเกจให้อัตโนมัติ
export function SubscriptionPaymentReview({
  initialPageInfo,
  initialPayments,
  initialSummary,
}: Readonly<{
  initialPageInfo: ServerPageInfo;
  initialPayments: Payment[];
  initialSummary: PaymentSummary;
}>) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [pageInfo, setPageInfo] = useState<ServerPageInfo>(initialPageInfo);
  const [summary, setSummary] = useState<PaymentSummary>(initialSummary);
  const [status, setStatus] = useState<PaymentStatusFilter>("PENDING_REVIEW");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedId, setSelectedId] = useState(initialPayments[0]?.id ?? "");
  const notifications = useSuperAdminNotifications();
  const skipInitialLoadRef = useRef(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const notify = useToast();

  // โหลดหน้าหนึ่งของรายการ preferredIndex ใช้ตอนเพิ่งตรวจเสร็จ จะได้เลือกรายการที่เลื่อนขึ้นมาแทนที่ตำแหน่งเดิม
  const load = useCallback(async (targetPage: number, preferredIndex = 0) => {
    setError(""); setIsLoading(true);
    try {
      let page = targetPage;
      let result = await fetchPaymentPage(page, status, query);
      // ตรวจรายการสุดท้ายของหน้าท้ายไปแล้ว หน้านั้นว่าง ถอยไปหน้าก่อนหน้าแทนการโชว์ตารางว่าง
      while (result.data.length === 0 && page > 1) {
        page -= 1;
        preferredIndex = Number.MAX_SAFE_INTEGER;
        result = await fetchPaymentPage(page, status, query);
      }
      setPayments(result.data);
      setPageInfo(result.pageInfo);
      setSelectedId(result.data[Math.min(preferredIndex, result.data.length - 1)]?.id ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดรายการไม่สำเร็จ"); }
    finally { setIsLoading(false); }
  }, [query, status]);

  const refreshSummary = useCallback(async () => {
    const response = await fetch("/api/v1/super-admin/subscription-payments/summary", { cache: "no-store" });
    if (response.ok) setSummary(((await response.json()) as { data: PaymentSummary }).data);
  }, []);

  // หน่วง 300 มิลลิวินาทีหลังหยุดพิมพ์หรือเปลี่ยนชิป จะได้ไม่ยิงทุกครั้งที่กดแป้น
  useEffect(() => {
    // เซิร์ฟเวอร์ส่งหน้าแรกของคิวรอตรวจมาแล้ว รอบแรกจึงข้ามไป
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => { void load(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  // คำแนะนำระหว่างพิมพ์ ยิงแยกจากตาราง เร็วกว่าและไม่ต้องรอผลค้นหาเต็ม
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ status, query: term });
      void fetch(`/api/v1/super-admin/subscription-payments/suggestions?${params}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => response.ok ? ((await response.json()) as { data: SearchSuggestion[] }).data : [])
        .then(setSuggestions)
        // พิมพ์ต่อจนคำขอเก่าโดนยกเลิก หรือเน็ตสะดุด ก็แค่ไม่มีคำแนะนำ ตารางยังค้นได้ตามปกติ
        .catch(() => undefined);
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, status]);

  const selectedIndex = payments.findIndex(({ id }) => id === selectedId);
  const selected = selectedIndex >= 0 ? payments[selectedIndex] : null;
  // มีรายการไหนกำลังตรวจอยู่ก็ปิดปุ่มทั้งหมด กันกดซ้อนหลายรายการพร้อมกัน
  const isReviewing = pendingId !== "";

  async function review(payment: Payment, decision: "APPROVED" | "REJECTED", note?: string) {
    const reviewedIndex = payments.findIndex(({ id }) => id === payment.id);
    setPendingId(payment.id); setError("");
    try {
      const response = await fetch(`/api/v1/super-admin/subscription-payments/${payment.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision, ...(note ? { rejectionNote: note } : {}) }),
      });
      const payload = await response.json() as { error?: string; requestId?: string };
      if (!response.ok) throw createApiError(payload, "ตรวจสอบรายการไม่สำเร็จ", response.status);
      setRejecting(null);
      setRejectionNote("");
      notify({ message: decision === "APPROVED" ? "อนุมัติค่าสมาชิกแล้ว" : "ปฏิเสธหลักฐานค่าสมาชิกแล้ว" });
      // ตรวจเสร็จหนึ่งรายการ ป้ายบนเมนู กระดิ่ง และการ์ดสรุปต้องเปลี่ยนตาม
      void notifications?.refresh();
      void refreshSummary();
      // โหลดหน้าเดิมใหม่ รายการจากหน้าถัดไปจะเลื่อนขึ้นมาเติม แล้วเลือกรายการถัดไปให้ตรวจต่อ
      await load(pageInfo.page, reviewedIndex);
    } catch (cause) {
      const message = formatClientError(cause, "ตรวจสอบรายการไม่สำเร็จ");
      setError(message);
      notify({ message, tone: "error" });
    }
    finally { setPendingId(""); }
  }

  function openRejectionDialog(payment: Payment) {
    setError("");
    setRejectionNote("");
    setRejecting(payment);
  }

  function submitRejection(event: SyntheticEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    const note = rejectionNote.trim();
    // บังคับกรอกเหตุผล เพราะเจ้าของหอต้องรู้ว่าต้องแก้อะไรก่อนส่งใหม่
    if (!rejecting || note.length < 2) return;
    void review(rejecting, "REJECTED", note);
  }

  return <>
    <div className="figma-summary-grid three subscription-review-summary">
      <SummaryCard icon={<Clock3 size={20} />} label="รอตรวจ" tone="orange" value={`${summary.pending.toLocaleString("th-TH")} รายการ`} />
      <SummaryCard icon={<BadgeCheck size={20} />} label="อนุมัติเดือนนี้" tone="green" value={`${summary.approvedThisMonth.toLocaleString("th-TH")} รายการ`} />
      <SummaryCard icon={<Wallet size={20} />} label="รับเงินเดือนนี้" tone="indigo" value={formatAmount(summary.approvedAmountThisMonth)} />
    </div>

    <section aria-label="ตรวจค่าสมาชิก" className="subscription-review">
      <div className="subscription-review-toolbar">
        <SearchSuggestField label="ค้นหารายการชำระ" onChange={setQuery} placeholder="ค้นหาหอ เลขคำสั่งซื้อ หรือแพ็กเกจ" suggestions={suggestions} value={query} />
        <div aria-label="กรองตามสถานะ" className="subscription-review-chips" role="group">
          {statusFilters.map((filter) => <button aria-pressed={status === filter.value} key={filter.value} onClick={() => setStatus(filter.value)} type="button">
            {filter.label}
            {filter.value === "PENDING_REVIEW" && summary.pending > 0 ? <span>{summary.pending > 99 ? "99+" : summary.pending}</span> : null}
          </button>)}
        </div>
      </div>
      {error && !rejecting ? <p className="form-alert error mx-4 mb-4" role="alert">{error}</p> : null}
      <div className="subscription-review-body">
        <div className="subscription-review-table">
          <PaymentTable hasQuery={Boolean(query.trim())} onSelect={setSelectedId} payments={payments} selectedId={selectedId} status={status} />
          {payments.length > 0 ? <ServerTablePagination currentItemCount={payments.length} disabled={isLoading || isReviewing} onPageChange={(page) => void load(page)} pageInfo={pageInfo} /> : null}
        </div>
        <aside aria-label="รายละเอียดสลิป" className="subscription-review-detail">
          {selected
            ? <PaymentDetail isReviewing={isReviewing} onApprove={() => void review(selected, "APPROVED")} onReject={() => openRejectionDialog(selected)} payment={selected} />
            : <div className="subscription-review-placeholder"><Inbox aria-hidden="true" size={28} /><p>{payments.length ? "เลือกรายการในตารางเพื่อดูสลิป" : "สลิปของรายการที่เลือกจะแสดงตรงนี้"}</p></div>}
        </aside>
      </div>
    </section>

    {rejecting ? <Dialog ariaDescribedBy="subscription-rejection-description" ariaLabelledBy="subscription-rejection-title" className="modal-sm" onClose={() => setRejecting(null)}>
        <header className="modal-header">
          <div>
            <h2 id="subscription-rejection-title">ปฏิเสธหลักฐานค่าสมาชิก</h2>
            <p id="subscription-rejection-description">{rejecting.order.property.name} · {rejecting.order.orderNumber}</p>
          </div>
          <IconButton disabled={isReviewing} label="ปิด" onClick={() => setRejecting(null)} tooltip="ปิดหน้าต่างปฏิเสธค่าสมาชิก"><X /></IconButton>
        </header>
        <form className="modal-form" onSubmit={submitRejection}>
          <label>
            <span>เหตุผลที่ปฏิเสธ</span>
            <textarea autoFocus maxLength={500} minLength={2} onChange={(event) => setRejectionNote(event.target.value)} placeholder="เช่น ยอดเงินไม่ตรง ภาพไม่ชัด หรือไม่พบรายการโอน" required value={rejectionNote} />
          </label>
          {error ? <p className="form-alert error" role="alert">{error}</p> : null}
          <footer className="modal-actions">
            <button disabled={isReviewing} onClick={() => setRejecting(null)} type="button">ยกเลิก</button>
            <button className="primary-button danger-confirm-button" disabled={isReviewing || rejectionNote.trim().length < 2} type="submit">{isReviewing ? "กำลังบันทึก..." : "ยืนยันปฏิเสธ"}</button>
          </footer>
        </form>
    </Dialog> : null}
  </>;
}

function SummaryCard({ icon, label, tone, value }: Readonly<{ icon: React.ReactNode; label: string; tone: string; value: string }>) {
  return <article className={`figma-summary-card tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}

// ตารางรายการ กดแถวไหนแผงขวาก็แสดงสลิปของแถวนั้น
// ว่างเพราะค้นไม่เจอ กับว่างเพราะไม่มีรายการในสถานะนี้ ต้องบอกคนละแบบ
function PaymentTable({ hasQuery, onSelect, payments, selectedId, status }: Readonly<{
  hasQuery: boolean;
  onSelect: (id: string) => void;
  payments: Payment[];
  selectedId: string;
  status: PaymentStatusFilter;
}>) {
  if (payments.length === 0 && hasQuery) {
    return <SearchEmptyState description="ลองพิมพ์ชื่อหอ เลขคำสั่งซื้อ หรือแพ็กเกจให้สั้นลง" title="ไม่พบรายการที่ค้นหา" />;
  }
  if (payments.length === 0) {
    return <p className="subscription-review-empty">{status === "PENDING_REVIEW" ? "ไม่มีรายการรอตรวจสอบ ตรวจครบแล้ว" : "ยังไม่มีรายการในสถานะนี้"}</p>;
  }
  return <div className="figma-table-wrap">
    <table>
      <thead><tr><th scope="col">หอพัก</th><th scope="col">คำสั่งซื้อ</th><th scope="col">แพ็กเกจ</th><th scope="col">ยอด</th><th scope="col">ส่งเมื่อ</th><th scope="col">สถานะ</th></tr></thead>
      <tbody>{payments.map((payment) => <tr aria-selected={payment.id === selectedId} data-testid="subscription-payment-review" key={payment.id} onClick={() => onSelect(payment.id)}>
        {/* ปุ่มในช่องแรกให้คนใช้คีย์บอร์ดเลือกแถวได้ ส่วนการคลิกทั้งแถวเป็นทางลัดของเมาส์ */}
        <td><button className="subscription-review-row-button" onClick={(event) => { event.stopPropagation(); onSelect(payment.id); }} type="button">{payment.order.property.name}</button></td>
        <td>
          <strong>{payment.order.orderNumber}</strong>
          <small className="block">{payment.order.type === "RENEWAL" ? "ต่ออายุ" : "สมัครใหม่"}</small>
        </td>
        <td>{payment.order.planName} · {intervalLabel(payment)}</td>
        <td className="tabular-nums">{formatAmount(payment.amount)}</td>
        <td>{new Date(payment.submittedAt).toLocaleString("th-TH")}</td>
        <td><span className={`badge ${statusBadge[payment.status]}`}>{statusLabels[payment.status]}</span></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

// แผงขวา สลิปกับข้อมูลที่ต้องใช้ตัดสินใจ ยอดที่ต้องตรงวางไว้ใกล้สลิป ผู้ตรวจจะได้เทียบได้ทันที
function PaymentDetail({ isReviewing, onApprove, onReject, payment }: Readonly<{
  isReviewing: boolean;
  onApprove: () => void;
  onReject: () => void;
  payment: Payment;
}>) {
  const isPdf = payment.mimeType === "application/pdf";
  // จำว่ารูปของรายการไหนโหลดไม่ขึ้น เปลี่ยนรายการแล้วจะได้ลองโหลดใหม่เอง ไม่ค้างสถานะเสียของรายการก่อน
  const [failedSlipId, setFailedSlipId] = useState("");
  return <article aria-labelledby="subscription-review-detail-title" className="subscription-review-article">
    <header className="subscription-review-detail-head">
      <div>
        <h2 id="subscription-review-detail-title">{payment.order.property.name}</h2>
        <p>{payment.order.orderNumber} · {payment.order.type === "RENEWAL" ? "ต่ออายุ" : "สมัครใหม่"}</p>
      </div>
      <a className="subscription-review-open" href={slipUrl(payment)} rel="noreferrer" target="_blank">
        <ExternalLink aria-hidden="true" size={15} /> เปิดไฟล์
      </a>
    </header>
    {/* key เป็น id บังคับให้โหลดไฟล์ใหม่ตอนเปลี่ยนรายการ ไม่งั้นค้างสลิปของรายการก่อน */}
    <div className="subscription-review-slip">
      {isPdf
        ? <iframe key={payment.id} src={slipUrl(payment)} title={`สลิป ${payment.order.orderNumber}`} />
        : failedSlipId === payment.id
          ? <div className="subscription-review-slip-missing"><FileText aria-hidden="true" size={24} /><p>เปิดสลิปไม่ได้ ไฟล์อาจถูกลบตามระยะเวลาเก็บข้อมูล ให้เจ้าของหอส่งใหม่</p></div>
          : <Image alt={`สลิป ${payment.order.orderNumber}`} fill key={payment.id} onError={() => setFailedSlipId(payment.id)} sizes="(min-width: 1280px) 380px, 100vw" src={slipUrl(payment)} unoptimized />}
    </div>
    <dl className="subscription-review-facts">
      <div><dt>ยอดในสลิปต้องเท่ากับ</dt><dd className="subscription-review-amount">{formatAmount(payment.amount)}</dd></div>
      <div><dt>แพ็กเกจ</dt><dd>{payment.order.planName} · {intervalLabel(payment)}</dd></div>
      <div><dt>ส่งเมื่อ</dt><dd>{new Date(payment.submittedAt).toLocaleString("th-TH")}</dd></div>
      <div><dt>ไฟล์</dt><dd><FileText aria-hidden="true" size={14} /> {fileLabel(payment)}</dd></div>
      {payment.reviewedAt ? <div><dt>ตรวจเมื่อ</dt><dd>{new Date(payment.reviewedAt).toLocaleString("th-TH")}</dd></div> : null}
      {payment.rejectionNote ? <div className="full-width"><dt>เหตุผลที่ปฏิเสธ</dt><dd>{payment.rejectionNote}</dd></div> : null}
    </dl>
    {/* ตรวจแล้วย้อนกลับไม่ได้ ปุ่มจึงมีเฉพาะรายการที่ยังรอตรวจ */}
    {payment.status === "PENDING_REVIEW" ? <footer className="subscription-review-actions">
      <button className="secondary-button" disabled={isReviewing} onClick={onReject} type="button"><X aria-hidden="true" size={16} /> ปฏิเสธ</button>
      <button className="primary-button" disabled={isReviewing} onClick={onApprove} type="button"><Check aria-hidden="true" size={16} /> {isReviewing ? "กำลังบันทึก..." : "อนุมัติ"}</button>
    </footer> : <p className={`subscription-review-status badge ${statusBadge[payment.status]}`}>{statusLabels[payment.status]}</p>}
  </article>;
}
