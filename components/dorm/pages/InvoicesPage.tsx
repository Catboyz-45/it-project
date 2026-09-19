"use client";
// เก็บตัวกรอง โหลดข้อมูลทีละหน้า และเปิดกล่องโต้ตอบจากเบราว์เซอร์

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Banknote, Ban, CheckCircle2, Clock3, Download, Eye, FilePlus2, Files, FileText, ReceiptText, Search, X } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
import { currency, getStatusClass, statusText, totalInvoice } from "@/lib/dorm-utils";
import { generateDocumentPdf, previewDocumentPdf } from "@/lib/client/documents";
import type { InvoiceDocumentData } from "@/lib/documents/placeholders";
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
import { PageHeaderActions } from "@/components/ui/PageHeaderSlot";
import { useActionFeedback } from "@/lib/client/use-action-feedback";

// หน้าบิล มีสองแท็บ รายการบิลของห้อง กับการตรวจหลักฐานการชำระ
export function InvoicesPage({
  initialPayments = null,
  initialView = "invoices",
  invoices,
  onChanged,
  propertyId,
  propertyName,
  readOnly = false,
  rooms,
}: {
  // ส่งต่อให้แท็บตรวจหลักฐานการชำระ
  initialPayments?: Parameters<typeof PaymentReviewPanel>[0]["initialPayments"];
  initialView?: "invoices" | "payments";
  invoices: Invoice[];
  onChanged: () => Promise<void>;
  propertyId: string;
  propertyName: string;
  readOnly?: boolean;
  rooms: Room[];
}) {
  const [view, setView] = useState<"invoices" | "payments">(initialView);
  // ข้อมูลจากเซิร์ฟเวอร์ใช้ได้แค่ตอนเปิดหน้าครั้งแรก ออกจากแท็บแล้วกลับมาให้โหลดใหม่ กันข้อมูลค้าง
  const [paymentSeed, setPaymentSeed] = useState(initialView === "payments" ? initialPayments : null);
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

  // เก็บแท็บไว้ใน URL เพื่อให้กดรีเฟรชหรือแชร์ลิงก์แล้วยังอยู่แท็บเดิม
  const changeView = (nextView: "invoices" | "payments") => {
    setView(nextView);
    const url = new URL(window.location.href);
    if (nextView === "payments") url.searchParams.set("tab", "payments");
    else url.searchParams.delete("tab");
    // ใช้ replaceState ไม่ใช่ router เพราะแค่เปลี่ยน URL ไม่ต้องให้ Next โหลดหน้าใหม่
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    // ออกจากแท็บแล้วชุดที่เซิร์ฟเวอร์ส่งมาถือว่าเก่า กลับเข้ามาอีกครั้งให้โหลดใหม่
    if (nextView !== "payments") setPaymentSeed(null);
  };

  const loadInvoices = useCallback(async (targetPage = 1, signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      // ให้เซิร์ฟเวอร์กรองทั้งคำค้นและสถานะ บิลสะสมเยอะเกินจะโหลดมาทั้งหมด
      const status = statusFilter === "all" ? "" : `&status=${statusFilter.toUpperCase()}`;
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices?page=${targetPage}&pageSize=20&query=${encodeURIComponent(query.trim())}${status}`, {
        cache: "no-store", signal,
      });
      const payload = await readApiPayload<{
        data?: Array<{
          id: string; invoiceNumber: string; status: string; version: number; billingMonth: string;
          room: { number: string; occupancies: Array<{ tenantProfile: { user: { displayName: string } } }> };
          items: Array<{ type: string; amount: string }>;
        }>;
        error?: string;
        requestId?: string;
        pageInfo?: ServerPageInfo;
        summary?: { draft: number; paid: number; pending: number; overdue: number; total: string };
      }>(response, "โหลดบิลไม่สำเร็จ");
      // ตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้ ต้องดักไว้ก่อน
      if (!payload.data || !payload.pageInfo || !payload.summary) throw new Error("ข้อมูลบิลที่ได้รับไม่ครบถ้วน");
      // แปลงจากรูปแบบของ API เป็นรูปแบบที่หน้าจอใช้
      const mapped: Invoice[] = payload.data.map((item) => {
        // API ส่งรายการค่าใช้จ่ายมาเป็นอาเรย์ ตัวช่วยนี้ดึงยอดของประเภทที่ต้องการออกมา
        const amount = (type: string) => Number(item.items.find((line) => line.type === type)?.amount ?? 0);
        return {
          id: item.invoiceNumber,
          databaseId: item.id,
          version: item.version,
          roomId: item.room.number,
          tenantName: item.room.occupancies[0]?.tenantProfile.user.displayName ?? "-",
          month: item.billingMonth.slice(0, 7),
          rent: amount("RENT"),
          water: amount("WATER"),
          electricity: amount("ELECTRICITY"),
          // ที่เหลือนอกจากค่าเช่า ค่าน้ำ ค่าไฟ รวมเป็นค่าบริการอื่น ๆ ก้อนเดียว
          service: item.items.filter((line) => !["RENT", "WATER", "ELECTRICITY"].includes(line.type)).reduce((sum, line) => sum + Number(line.amount), 0),
          status: item.status === "DRAFT" ? "draft" : item.status === "PAID" ? "paid" : item.status === "OVERDUE" ? "overdue" : item.status === "CANCELLED" ? "cancelled" : "pending",
        };
      });
      setLoadedInvoices(mapped);
      setPageInfo(payload.pageInfo);
      setSummary(payload.summary);
    } catch (error) {
      // ยกเลิกเองตอนผู้ใช้พิมพ์ต่อ ไม่ใช่ข้อผิดพลาดจริง ไม่ต้องขึ้นเตือนให้ตกใจ
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(formatClientError(error, "โหลดบิลไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, query, statusFilter]);

  // เปลี่ยนร่างเป็นบิลจริง หลังจากนี้ผู้เช่าจะเห็นและชำระได้
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
        // ส่ง version ไปด้วย เซิร์ฟเวอร์จะปฏิเสธถ้ามีคนอื่นแก้บิลใบนี้ไปแล้ว กันแก้ทับกัน
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

  // ยกเลิกบิล ไม่ได้ลบทิ้ง เพราะต้องเก็บไว้ในประวัติพร้อมเหตุผลเพื่อตรวจสอบย้อนหลังได้
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
      // ไม่คืนโฟกัส เพราะกล่องกรอกเหตุผลปิดตัวเองและจัดการโฟกัสอยู่แล้ว
      }, { pending: "กำลังยกเลิกบิล...", success: "ยกเลิกบิลแล้ว", error: "ยกเลิกบิลไม่สำเร็จ" }, { restoreFocus: false });
    } catch (error) {
      setLoadError(formatClientError(error, "ยกเลิกบิลไม่สำเร็จ"));
    } finally {
      setIsCancelling(false);
    }
  };

  // สร้างเอกสารบิล ดูตัวอย่างหรือดาวน์โหลดจริง
  const requestInvoicePdf = async (invoice: Invoice, action: "preview" | "generate") => {
    if (actionFeedback.isPending) return;
    // ประกอบข้อมูลให้ตรงกับช่องว่างใน Template ของเอกสาร
    const data: InvoiceDocumentData = {
      property_name: propertyName,
      room_number: invoice.roomId,
      tenant_name: invoice.tenantName,
      reference_id: invoice.id,
      billing_month: invoice.month,
      rent_amount: invoice.rent,
      water_amount: invoice.water,
      electricity_amount: invoice.electricity,
      service_amount: invoice.service,
      total_amount: totalInvoice(invoice),
    };
    try {
      await actionFeedback.runAction(
        async () => {
          if (action === "preview") await previewDocumentPdf(propertyId, "invoice", data);
          else await generateDocumentPdf(propertyId, "invoice", data);
        },
        action === "preview"
          ? { pending: "กำลังสร้างตัวอย่าง...", success: "เปิดตัวอย่างบิลแล้ว", error: "ดูตัวอย่างบิลไม่สำเร็จ" }
          : { pending: "กำลังสร้าง PDF...", success: "ดาวน์โหลด PDF บิลแล้ว", error: "สร้าง PDF บิลไม่สำเร็จ" },
      );
    } catch {
      // actionFeedback แจ้งผู้ใช้ไปแล้วทั้งทาง toast และเสียงอ่าน ตรงนี้จึงไม่ต้องทำอะไรซ้ำ
      // แต่ต้องดักไว้ ไม่งั้นเป็น unhandled rejection
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    // หน่วง 250 มิลลิวินาทีหลังหยุดพิมพ์ จะได้ไม่ยิงทุกครั้งที่กดแป้น
    // ส่วน abort ยกเลิกคำขอเก่า กันผลเก่ามาถึงทีหลังแล้วทับผลใหม่
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
      {view === "payments" ? <PaymentReviewPanel initialPayments={paymentSeed} onChanged={onChanged} propertyId={propertyId} readOnly={readOnly} /> : <>
      <article className="figma-table-card">
        {/* ส่งปุ่มสร้างร่างขึ้นไปแสดงบนแถบหัวเรื่องของ shell แทนที่จะอยู่ในหน้า */}
        <PageHeaderActions>
          {!readOnly ? <button className="primary-button" onClick={() => setGenerationMode("bulk")} type="button"><Files size={16} /> สร้างร่างทั้งหอ</button> : <ReadOnlyNotice compact />}
        </PageHeaderActions>
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
              {/* รายการในเมนูขึ้นกับสถานะบิล ร่างยังออกบิลได้ ที่ออกไปแล้วเหลือแค่ตรวจการชำระ */}
              <span><ActionMenu
                items={[
                  { disabled: actionFeedback.isPending, icon: <Eye aria-hidden="true" size={16} />, id: "preview-pdf", label: "ดูตัวอย่างบิล (PDF)", onSelect: () => void requestInvoicePdf(invoice, "preview") },
                  // ร่างยังไม่มีเลขบิลจริง จึงให้ดูตัวอย่างได้อย่างเดียว ยังดาวน์โหลดไม่ได้
                  ...(invoice.status !== "draft" ? [
                    { disabled: actionFeedback.isPending, icon: <Download aria-hidden="true" size={16} />, id: "generate-pdf", label: "ดาวน์โหลด PDF บิล", onSelect: () => void requestInvoicePdf(invoice, "generate") },
                  ] : []),
                  // บิลที่ชำระแล้วหรือยกเลิกแล้วเป็นอันจบ ไม่มีอะไรให้ทำต่อ
                  ...(!readOnly && invoice.status !== "paid" && invoice.status !== "cancelled" ? (invoice.status === "draft" ? [
                    { disabled: actionFeedback.isPending, icon: <ReceiptText aria-hidden="true" size={16} />, id: "issue", label: actionFeedback.isPending ? "กำลังออกบิล..." : "ออกบิล", onSelect: () => void issueDraft(invoice) },
                    { icon: <Ban aria-hidden="true" size={16} />, id: "cancel", label: "ยกเลิกบิล", onSelect: () => { setCancellationReason(""); setInvoiceToCancel(invoice); }, variant: "danger" as const },
                  ] : [
                    { icon: <CheckCircle2 aria-hidden="true" size={16} />, id: "review-payment", label: "ตรวจสอบหลักฐานการชำระ", onSelect: () => changeView("payments") },
                    { icon: <Ban aria-hidden="true" size={16} />, id: "cancel", label: "ยกเลิกบิล", onSelect: () => { setCancellationReason(""); setInvoiceToCancel(invoice); }, variant: "danger" as const },
                  ]) : []),
                ]}
                label={`จัดการบิล ${invoice.id}`}
              /></span>
            </div>
          ))}
        </div>
        {/* ว่างเพราะกรองจนไม่เหลือ กับว่างเพราะยังไม่มีบิลเลย ต้องบอกคนละแบบ */}
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
      {/* บังคับกรอกเหตุผลอย่างน้อย 3 ตัวอักษร เพราะเหตุผลนี้ถูกเก็บไว้ในประวัติถาวร */}
      {invoiceToCancel ? (
        <Dialog ariaDescribedBy="invoice-cancel-description" ariaLabelledBy="invoice-cancel-title" className="modal-sm" onClose={() => { if (!isCancelling) setInvoiceToCancel(null); }}>
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

// การ์ดตัวเลขสรุปด้านบน ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function InvoiceSummary({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: string }) {
  return <article className={`figma-summary-card compact tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
