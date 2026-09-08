"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Invoices Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Banknote, Ban, CheckCircle2, Clock3, Download, FilePlus2, Files, FileText, ReceiptText, Search, X } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
import { currency, getStatusClass, statusText, totalInvoice } from "@/lib/dorm-utils";
import type { Invoice, Room } from "@/types/dorm";
import { ServerTablePagination, type ServerPageInfo } from "@/components/dorm/TablePagination";
import { formatClientError, readApiPayload } from "@/lib/client/api-error";
import { PaymentReviewPanel } from "@/components/dorm/PaymentReviewPanel";
import { InvoiceGenerationDialog } from "@/components/dorm/InvoiceGenerationDialog";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { useActionFeedback } from "@/lib/client/use-action-feedback";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Invoices Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { initialView = "invoices", invoices, onChanged, propertyId,: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function InvoicesPage({
  initialView = "invoices",
  invoices,
  onChanged,
  propertyId,
  readOnly = false,
  rooms,
}: {
  initialView?: "invoices" | "payments";
  invoices: Invoice[];
  onChanged: () => Promise<void>;
  propertyId: string;
  readOnly?: boolean;
  rooms: Room[];
}) {
  const [view, setView] = useState<"invoices" | "payments">(initialView);
  const [generationMode, setGenerationMode] = useState<"single" | "bulk" | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadedInvoices, setLoadedInvoices] = useState(invoices);
  const [pageInfo, setPageInfo] = useState<ServerPageInfo>({ page: 1, pageSize: 20, hasNextPage: false });
  const [summary, setSummary] = useState({ draft: 0, paid: 0, pending: 0, overdue: 0, total: "0" });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const actionFeedback = useActionFeedback();

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “change View” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - nextView: ค่า “next View” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const changeView = (nextView: "invoices" | "payments") => {
    setView(nextView);
    const url = new URL(window.location.href);
    if (nextView === "payments") url.searchParams.set("tab", "payments");
    else url.searchParams.delete("tab");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Invoices” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - signal: ค่า “signal” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const loadInvoices = useCallback(async (targetPage = 1, signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const status = statusFilter === "all" ? "" : `&status=${statusFilter.toUpperCase()}`;
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices?page=${targetPage}&pageSize=20&query=${encodeURIComponent(query.trim())}${status}`, {
        cache: "no-store", signal,
      });
      const payload = await readApiPayload<{
        data?: Array<{
          id: string; invoiceNumber: string; status: string; version: number;
          room: { number: string; occupancies: Array<{ tenantProfile: { user: { displayName: string } } }> };
          items: Array<{ type: string; amount: string }>;
        }>;
        error?: string;
        requestId?: string;
        pageInfo?: ServerPageInfo;
        summary?: { draft: number; paid: number; pending: number; overdue: number; total: string };
      }>(response, "โหลดบิลไม่สำเร็จ");
      if (!payload.data || !payload.pageInfo || !payload.summary) throw new Error("ข้อมูลบิลที่ได้รับไม่ครบถ้วน");
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: แปลงข้อมูลในขั้นตอน “mapped” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
       * รับค่า:
       * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
       */
      const mapped: Invoice[] = payload.data.map((item) => {
        /**
         * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
         * หน้าที่: รวมขั้นตอนย่อยของ “amount” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
         * รับค่า:
         * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
         * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
         */
        const amount = (type: string) => Number(item.items.find((line) => line.type === type)?.amount ?? 0);
        return {
          id: item.invoiceNumber,
          databaseId: item.id,
          version: item.version,
          roomId: item.room.number,
          tenantName: item.room.occupancies[0]?.tenantProfile.user.displayName ?? "-",
          month: "",
          rent: amount("RENT"),
          water: amount("WATER"),
          electricity: amount("ELECTRICITY"),
          service: item.items.filter((line) => !["RENT", "WATER", "ELECTRICITY"].includes(line.type)).reduce((sum, line) => sum + Number(line.amount), 0),
          status: item.status === "DRAFT" ? "draft" : item.status === "PAID" ? "paid" : item.status === "OVERDUE" ? "overdue" : item.status === "CANCELLED" ? "cancelled" : "pending",
        };
      });
      setLoadedInvoices(mapped);
      setPageInfo(payload.pageInfo);
      setSummary(payload.summary);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(formatClientError(error, "โหลดบิลไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, query, statusFilter]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “issue Draft” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - invoice: ค่า “invoice” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const issueDraft = async (invoice: Invoice) => {
    if (!invoice.databaseId || !invoice.version) return;
    if (actionFeedback.isPending) return;
    setLoadError("");
    try {
      await actionFeedback.runAction(async () => {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices/${invoice.databaseId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: invoice.version }),
      });
      await readApiPayload(response, "ออกบิลไม่สำเร็จ");
      await onChanged();
      await loadInvoices();
      }, { pending: "กำลังออกบิล...", success: "ออกบิลแล้ว", error: "ออกบิลไม่สำเร็จ" });
    } catch (error) {
      setLoadError(formatClientError(error, "ออกบิลไม่สำเร็จ"));
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “cancel Selected Invoice” ตามกฎของระบบ
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const cancelSelectedInvoice = async () => {
    if (!invoiceToCancel?.databaseId || !invoiceToCancel.version || cancellationReason.trim().length < 3) return;
    if (isCancelling || actionFeedback.isPending) return;
    setIsCancelling(true);
    setLoadError("");
    try {
      await actionFeedback.runAction(async () => {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices/${invoiceToCancel.databaseId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", version: invoiceToCancel.version, reason: cancellationReason.trim() }),
      });
      await readApiPayload(response, "ยกเลิกบิลไม่สำเร็จ");
      setInvoiceToCancel(null);
      setCancellationReason("");
      await onChanged();
      await loadInvoices();
      }, { pending: "กำลังยกเลิกบิล...", success: "ยกเลิกบิลแล้ว", error: "ยกเลิกบิลไม่สำเร็จ" }, { restoreFocus: false });
    } catch (error) {
      setLoadError(formatClientError(error, "ยกเลิกบิลไม่สำเร็จ"));
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “timeout” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const timeout = window.setTimeout(() => void loadInvoices(1, controller.signal), 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [loadInvoices]);

  return (
    <section className="figma-list-page invoices-page">
      <LiveAnnouncement message={actionFeedback.announcement} />
      <div className="figma-summary-grid five">
        <InvoiceSummary icon={<FileText />} label="ฉบับร่าง" value={`${summary.draft}`} tone="indigo" />
        <InvoiceSummary icon={<CheckCircle2 />} label="ชำระแล้ว" value={`${summary.paid}`} tone="green" />
        <InvoiceSummary icon={<Clock3 />} label="รอชำระ" value={`${summary.pending}`} tone="orange" />
        <InvoiceSummary icon={<AlertCircle />} label="ค้างชำระ" value={`${summary.overdue}`} tone="red" />
        <InvoiceSummary icon={<Banknote />} label="ยอดรวม" value={currency.format(Number(summary.total))} tone="blue" />
      </div>
      <div className="figma-inline-tabs invoice-tabs">
        <button className={view === "invoices" ? "active" : ""} onClick={() => changeView("invoices")} type="button">บิลห้องพัก</button>
        <button className={view === "payments" ? "active" : ""} onClick={() => changeView("payments")} type="button">ตรวจสอบการชำระ</button>
      </div>
      {view === "payments" ? <PaymentReviewPanel onChanged={onChanged} propertyId={propertyId} readOnly={readOnly} /> : <>
      <article className="figma-table-card">
        <div className="additional-card-head">
          <div><h2>รายการบิลห้องพัก</h2><p>ตรวจสอบยอด ค่าใช้จ่าย สถานะ และจัดการบิลรายห้อง</p></div>
          {!readOnly ? <button className="primary-button" onClick={() => setGenerationMode("bulk")} type="button"><Files size={16} /> สร้างร่างทั้งหอ</button> : <ReadOnlyNotice compact />}
        </div>
        {loadError ? <p className="form-alert error" role="alert">{loadError}</p> : null}
        <div className="figma-table-toolbar">
          <div><Search size={16} /><input aria-label="ค้นหาบิล" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขที่บิล ห้อง หรือผู้เช่า..." value={query} /></div>
          <div className="contract-actions">
            <DropdownField label="กรองสถานะ" onChange={setStatusFilter} options={[{ value: "all", label: "ทุกสถานะ" }, { value: "draft", label: "ฉบับร่าง" }, { value: "paid", label: "ชำระแล้ว" }, { value: "pending", label: "รอชำระ" }, { value: "overdue", label: "ค้างชำระ" }, { value: "cancelled", label: "ยกเลิก" }]} value={statusFilter} />
            <a className="secondary-button" download href={`/api/v1/admin/properties/${propertyId}/exports/invoices?query=${encodeURIComponent(query.trim())}${statusFilter === "all" ? "" : `&status=${statusFilter.toUpperCase()}`}`}><Download size={16} /> ส่งออก CSV</a>
            {!readOnly ? <>
              <button className="secondary-button" onClick={() => setGenerationMode("single")} type="button"><FilePlus2 size={16} /> สร้างร่างรายห้อง</button>
            </> : null}
          </div>
        </div>
        <div className="figma-table invoice-table">
          <div className="figma-table-head"><span>เลขที่บิล</span><span>ห้อง</span><span>ผู้เช่า</span><span>ค่าเช่า</span><span>ค่าน้ำ</span><span>ค่าไฟ</span><span>ยอดรวม</span><span>สถานะ</span><span /></div>
          {loadedInvoices.map((invoice) => (
            <div className="figma-table-row" data-status={invoice.status} key={invoice.id}>
              <span>{invoice.id}</span><span>{invoice.roomId}</span><span>{invoice.tenantName}</span>
              <span>{currency.format(invoice.rent)}</span><span>{currency.format(invoice.water)}</span><span>{currency.format(invoice.electricity)}</span>
              <span><strong>{currency.format(totalInvoice(invoice))}</strong></span>
              <span><em className={`figma-status ${getStatusClass(invoice.status)}`}>{statusText[invoice.status]}</em></span>
              <span>{!readOnly && invoice.status !== "paid" && invoice.status !== "cancelled" ? <ActionMenu
                items={invoice.status === "draft" ? [
                  { disabled: actionFeedback.isPending, icon: <ReceiptText aria-hidden="true" size={16} />, id: "issue", label: actionFeedback.isPending ? "กำลังออกบิล..." : "ออกบิล", onSelect: () => void issueDraft(invoice) },
                  { icon: <Ban aria-hidden="true" size={16} />, id: "cancel", label: "ยกเลิกบิล", onSelect: () => { setCancellationReason(""); setInvoiceToCancel(invoice); }, variant: "danger" },
                ] : [
                  { icon: <CheckCircle2 aria-hidden="true" size={16} />, id: "review-payment", label: "ตรวจสอบหลักฐานการชำระ", onSelect: () => changeView("payments") },
                  { icon: <Ban aria-hidden="true" size={16} />, id: "cancel", label: "ยกเลิกบิล", onSelect: () => { setCancellationReason(""); setInvoiceToCancel(invoice); }, variant: "danger" },
                ]}
                label={`จัดการบิล ${invoice.id}`}
              /> : null}</span>
            </div>
          ))}
        </div>
        {!isLoading && !loadError && loadedInvoices.length === 0 && (query.trim() || statusFilter !== "all") ? (
          <SearchEmptyState description="ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" title="ไม่พบบิลตามเงื่อนไข" />
        ) : !isLoading && !loadError && loadedInvoices.length === 0 ? <p className="settings-empty-list">ยังไม่มีบิล</p> : null}
        <ServerTablePagination currentItemCount={loadedInvoices.length} disabled={isLoading} onPageChange={(nextPage) => void loadInvoices(nextPage)} pageInfo={pageInfo} />
      </article>
      </>}
      {generationMode ? <InvoiceGenerationDialog
        initialMode={generationMode}
        onChanged={async () => { await onChanged(); await loadInvoices(); }}
        onClose={() => setGenerationMode(null)}
        propertyId={propertyId}
        rooms={rooms}
      /> : null}
      {invoiceToCancel ? (
        <Dialog ariaDescribedBy="invoice-cancel-description" ariaLabelledBy="invoice-cancel-title" onClose={() => { if (!isCancelling) setInvoiceToCancel(null); }}>
          <header className="modal-header">
            <div>
              <h2 id="invoice-cancel-title">ยกเลิกบิล {invoiceToCancel.id}</h2>
              <p id="invoice-cancel-description">บิลจะถูกเก็บไว้ในประวัติพร้อมเหตุผล และไม่สามารถนำไปชำระได้</p>
            </div>
            <IconButton disabled={isCancelling} label="ปิด" onClick={() => setInvoiceToCancel(null)} tooltip="ปิดหน้าต่างยกเลิกบิล"><X /></IconButton>
          </header>
          <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void cancelSelectedInvoice(); }}>
            <label>
              <span>เหตุผลที่ยกเลิก</span>
              <textarea autoFocus maxLength={500} minLength={3} onChange={(event) => setCancellationReason(event.target.value)} placeholder="เช่น ออกบิลผิดห้อง หรือยอดค่าใช้จ่ายไม่ถูกต้อง" required value={cancellationReason} />
            </label>
            <footer className="modal-actions">
              <button disabled={isCancelling} onClick={() => setInvoiceToCancel(null)} type="button">กลับ</button>
              <button aria-describedby={!isCancelling && cancellationReason.trim().length < 3 ? "invoice-cancel-disabled-reason" : undefined} className="primary-button danger-confirm-button" disabled={isCancelling || cancellationReason.trim().length < 3} type="submit">{isCancelling ? "กำลังยกเลิก..." : "ยืนยันยกเลิกบิล"}</button>
            </footer>
            {!isCancelling && cancellationReason.trim().length < 3 ? <p className="disabled-reason justify-self-end" id="invoice-cancel-disabled-reason">ระบุเหตุผลอย่างน้อย 3 ตัวอักษรก่อนยืนยัน</p> : null}
          </form>
        </Dialog>
      ) : null}
    </section>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Invoice Summary” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { icon, label, tone, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function InvoiceSummary({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: string }) {
  return <article className={`figma-summary-card compact tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
