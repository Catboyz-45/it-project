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
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { PageHeaderActions } from "@/components/ui/PageHeaderSlot";
import { useActionFeedback } from "@/lib/client/use-action-feedback";

// หน้าบิล มีสองแท็บ รายการบิลของห้อง กับการตรวจหลักฐานการชำระ
// แถบค้นหาและกรองของหน้าบิล รวมลิงก์ส่งออก CSV ที่ใช้เงื่อนไขเดียวกับที่กรองอยู่
function InvoiceToolbar({ onGenerateSingle, onQueryChange, onStatusChange, propertyId, query, readOnly, statusFilter }: Readonly<{
  onGenerateSingle: () => void;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  propertyId: string;
  query: string;
  readOnly: boolean;
  statusFilter: string;
}>) {
  const exportQuery = new URLSearchParams({ query: query.trim() });
  if (statusFilter !== "all") exportQuery.set("status", statusFilter.toUpperCase());

  return <div className="figma-table-toolbar">
    <div><Search size={16} /><input aria-label="ค้นหาบิล" onChange={(event) => onQueryChange(event.target.value)} placeholder="ค้นหาเลขที่บิล ห้อง หรือผู้เช่า..." value={query} /></div>
    <div className="contract-actions">
      <DropdownField
        label="กรองสถานะ"
        onChange={onStatusChange}
        options={[
          { value: "all", label: "ทุกสถานะ" },
          { value: "draft", label: "ฉบับร่าง" },
          { value: "paid", label: "ชำระแล้ว" },
          { value: "pending", label: "รอชำระ" },
          { value: "overdue", label: "ค้างชำระ" },
          { value: "cancelled", label: "ยกเลิก" },
        ]}
        value={statusFilter}
      />
      <a className="secondary-button" download href={`/api/v1/admin/properties/${propertyId}/exports/invoices?${exportQuery}`}><Download size={16} /> ส่งออก CSV</a>
      {!readOnly ? <button className="secondary-button" onClick={onGenerateSingle} type="button"><FilePlus2 size={16} /> สร้างร่างรายห้อง</button> : null}
    </div>
  </div>;
}

// การ์ดตัวเลขสรุปด้านบนของหน้าบิล
function InvoiceSummaryGrid({ summary }: Readonly<{ summary: { draft: number; paid: number; pending: number; overdue: number; total: string } }>) {
  return <div className="figma-summary-grid five">
    <InvoiceSummary icon={<FileText />} label="ฉบับร่าง" tone="indigo" value={`${summary.draft}`} />
    <InvoiceSummary icon={<CheckCircle2 />} label="ชำระแล้ว" tone="green" value={`${summary.paid}`} />
    <InvoiceSummary icon={<Clock3 />} label="รอชำระ" tone="orange" value={`${summary.pending}`} />
    <InvoiceSummary icon={<AlertCircle />} label="ค้างชำระ" tone="red" value={`${summary.overdue}`} />
    <InvoiceSummary icon={<Banknote />} label="ยอดรวม" tone="blue" value={currency.format(Number(summary.total))} />
  </div>;
}

// ยกเลิกบิล ไม่ได้ลบทิ้ง เพราะต้องเก็บไว้ในประวัติพร้อมเหตุผลเพื่อตรวจสอบย้อนหลังได้
async function cancelInvoiceRequest(propertyId: string, invoice: Invoice, reason: string) {
  const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices/${invoice.databaseId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel", version: invoice.version, reason }),
  });
  await readApiPayload(response, "ยกเลิกบิลไม่สำเร็จ");
}

// ประกอบข้อมูลให้ตรงกับช่องว่างใน Template ของเอกสาร
function invoiceDocumentData(invoice: Invoice, propertyName: string): InvoiceDocumentData {
  return {
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
}

async function runInvoiceDocument(action: "preview" | "generate", propertyId: string, data: InvoiceDocumentData) {
  if (action === "preview") await previewDocumentPdf(propertyId, "invoice", data);
  else await generateDocumentPdf(propertyId, "invoice", data);
}

function invoiceDocumentMessages(action: "preview" | "generate") {
  return action === "preview"
    ? { pending: "กำลังสร้างตัวอย่าง...", success: "เปิดตัวอย่างบิลแล้ว", error: "ดูตัวอย่างบิลไม่สำเร็จ" }
    : { pending: "กำลังสร้าง PDF...", success: "ดาวน์โหลด PDF บิลแล้ว", error: "สร้าง PDF บิลไม่สำเร็จ" };
}

// เก็บแท็บไว้ใน URL เพื่อให้กดรีเฟรชหรือแชร์ลิงก์แล้วยังอยู่แท็บเดิม
// ใช้ replaceState ไม่ใช่ router เพราะแค่เปลี่ยน URL ไม่ต้องให้ Next โหลดหน้าใหม่
function rememberInvoiceTab(nextView: "invoices" | "payments") {
  const url = new URL(window.location.href);
  if (nextView === "payments") url.searchParams.set("tab", "payments");
  else url.searchParams.delete("tab");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

// บิลที่ถูกบันทึกลงฐานแล้วเท่านั้นที่สั่งงานต่อได้ ร่างที่ยังอยู่แต่ในหน้าจอยังไม่มี id
function isSavedInvoice(invoice: Invoice | null) {
  return Boolean(invoice?.databaseId && invoice.version);
}

// เปลี่ยนร่างเป็นบิลจริง ส่ง version ไปด้วย เซิร์ฟเวอร์จะปฏิเสธถ้ามีคนอื่นแก้บิลใบนี้ไปแล้ว
async function issueInvoiceRequest(propertyId: string, invoice: Invoice) {
  const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices/${invoice.databaseId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: invoice.version }),
  });
  await readApiPayload(response, "ออกบิลไม่สำเร็จ");
}

// ยกเลิกได้ต่อเมื่อบิลถูกบันทึกลงฐานแล้ว และมีเหตุผลอย่างน้อย 3 ตัวอักษร
function canCancelInvoice(invoice: Invoice | null, reason: string) {
  return isSavedInvoice(invoice) && reason.length >= 3;
}

// มุมมองรายการบิล แยกจากแท็บตรวจหลักฐานการชำระที่อยู่ในคอมโพเนนต์ของตัวเอง
function InvoiceListView({ actionFeedback, invoices, isLoading, loadError, onCancel, onGenerateBulk, onGenerateSingle, onIssue, onPageChange, onQueryChange, onRequestPdf, onReviewPayments, onStatusChange, pageInfo, propertyId, query, readOnly, statusFilter }: Readonly<{
  actionFeedback: ReturnType<typeof useActionFeedback>;
  invoices: Invoice[];
  isLoading: boolean;
  loadError: string;
  onCancel: (invoice: Invoice) => void;
  onGenerateBulk: () => void;
  onGenerateSingle: () => void;
  onIssue: (invoice: Invoice) => Promise<void>;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onRequestPdf: (invoice: Invoice, action: "preview" | "generate") => Promise<void>;
  onReviewPayments: () => void;
  onStatusChange: (value: string) => void;
  pageInfo: ServerPageInfo;
  propertyId: string;
  query: string;
  readOnly: boolean;
  statusFilter: string;
}>) {
  const showEmptyState = !isLoading && !loadError && invoices.length === 0;
  const hasCriteria = Boolean(query.trim()) || statusFilter !== "all";

  return <article className="figma-table-card">
    {/* ส่งปุ่มสร้างร่างขึ้นไปแสดงบนแถบหัวเรื่องของ shell แทนที่จะอยู่ในหน้า */}
    <PageHeaderActions>
      {readOnly ? <ReadOnlyNotice compact /> : <button className="primary-button" onClick={onGenerateBulk} type="button"><Files size={16} /> สร้างร่างทั้งหอ</button>}
    </PageHeaderActions>
    {loadError ? <p className="form-alert error" role="alert">{loadError}</p> : null}
    <InvoiceToolbar
      onGenerateSingle={onGenerateSingle}
      onQueryChange={onQueryChange}
      onStatusChange={onStatusChange}
      propertyId={propertyId}
      query={query}
      readOnly={readOnly}
      statusFilter={statusFilter}
    />
    <InvoiceTable
      actionFeedback={actionFeedback}
      invoices={invoices}
      onCancel={onCancel}
      onIssue={onIssue}
      onRequestPdf={onRequestPdf}
      onReviewPayments={onReviewPayments}
      readOnly={readOnly}
    />
    {/* ว่างเพราะกรองจนไม่เหลือ กับว่างเพราะยังไม่มีบิลเลย ต้องบอกคนละแบบ */}
    {showEmptyState && hasCriteria ? <SearchEmptyState description="ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" title="ไม่พบบิลตามเงื่อนไข" /> : null}
    {showEmptyState && !hasCriteria ? <p className="settings-empty-list">ยังไม่มีบิล</p> : null}
    <ServerTablePagination currentItemCount={invoices.length} disabled={isLoading} onPageChange={onPageChange} pageInfo={pageInfo} />
  </article>;
}

export function InvoicesPage({
  initialPayments = null,
  initialView = "invoices",
  invoices,
  onChanged,
  propertyId,
  propertyName,
  readOnly = false,
  rooms,
}: Readonly<{
  // ส่งต่อให้แท็บตรวจหลักฐานการชำระ
  initialPayments?: Parameters<typeof PaymentReviewPanel>[0]["initialPayments"];
  initialView?: "invoices" | "payments";
  invoices: Invoice[];
  onChanged: () => Promise<void>;
  propertyId: string;
  propertyName: string;
  readOnly?: boolean;
  rooms: Room[];
}>) {
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

  const changeView = (nextView: "invoices" | "payments") => {
    setView(nextView);
    rememberInvoiceTab(nextView);
    // ออกจากแท็บแล้วชุดที่เซิร์ฟเวอร์ส่งมาถือว่าเก่า กลับเข้ามาอีกครั้งให้โหลดใหม่
    if (nextView !== "payments") setPaymentSeed(null);
  };

  const loadInvoices = useCallback(async (targetPage = 1, signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const result = await requestInvoices({ page: targetPage, propertyId, query, signal, statusFilter });
      setLoadedInvoices(result.invoices);
      setPageInfo(result.pageInfo);
      setSummary(result.summary);
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
    if (!isSavedInvoice(invoice) || actionFeedback.isPending) return;
    setLoadError("");
    try {
      await actionFeedback.runAction(async () => {
        await issueInvoiceRequest(propertyId, invoice);
        await onChanged();
        await loadInvoices();
      }, { pending: "กำลังออกบิล...", success: "ออกบิลแล้ว", error: "ออกบิลไม่สำเร็จ" });
    } catch (error) {
      setLoadError(formatClientError(error, "ออกบิลไม่สำเร็จ"));
    }
  };

  // ยกเลิกบิล ไม่ได้ลบทิ้ง เพราะต้องเก็บไว้ในประวัติพร้อมเหตุผลเพื่อตรวจสอบย้อนหลังได้
  const cancelSelectedInvoice = async () => {
    const invoice = invoiceToCancel;
    const reason = cancellationReason.trim();
    if (!canCancelInvoice(invoice, reason) || isCancelling || actionFeedback.isPending) return;
    setIsCancelling(true);
    setLoadError("");
    try {
      await actionFeedback.runAction(async () => {
        await cancelInvoiceRequest(propertyId, invoice!, reason);
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
    try {
      await actionFeedback.runAction(
        () => runInvoiceDocument(action, propertyId, invoiceDocumentData(invoice, propertyName)),
        invoiceDocumentMessages(action),
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
      <InvoiceSummaryGrid summary={summary} />
      <div className="figma-inline-tabs invoice-tabs">
        <button className={view === "invoices" ? "active" : ""} onClick={() => changeView("invoices")} type="button">บิลห้องพัก</button>
        <button className={view === "payments" ? "active" : ""} onClick={() => changeView("payments")} type="button">ตรวจสอบการชำระ</button>
      </div>
      {view === "payments" ? <PaymentReviewPanel initialPayments={paymentSeed} onChanged={onChanged} propertyId={propertyId} readOnly={readOnly} /> : <InvoiceListView
        actionFeedback={actionFeedback}
        invoices={loadedInvoices}
        isLoading={isLoading}
        loadError={loadError}
        onCancel={(invoice) => { setCancellationReason(""); setInvoiceToCancel(invoice); }}
        onGenerateBulk={() => setGenerationMode("bulk")}
        onGenerateSingle={() => setGenerationMode("single")}
        onIssue={issueDraft}
        onPageChange={(nextPage) => void loadInvoices(nextPage)}
        onQueryChange={setQuery}
        onRequestPdf={requestInvoicePdf}
        onReviewPayments={() => changeView("payments")}
        onStatusChange={setStatusFilter}
        pageInfo={pageInfo}
        propertyId={propertyId}
        query={query}
        readOnly={readOnly}
        statusFilter={statusFilter}
      />}
      {generationMode ? <InvoiceGenerationDialog
        initialMode={generationMode}
        onChanged={async () => { await onChanged(); await loadInvoices(); }}
        onClose={() => setGenerationMode(null)}
        propertyId={propertyId}
        rooms={rooms}
      /> : null}
      <CancelInvoiceDialog
        invoice={invoiceToCancel}
        isCancelling={isCancelling}
        onClose={() => { if (!isCancelling) setInvoiceToCancel(null); }}
        onSubmit={cancelSelectedInvoice}
        reason={cancellationReason}
        setReason={setCancellationReason}
      />
    </section>
  );
}

// รูปแบบที่ API ส่งกลับมา ต่างจากที่หน้าจอใช้ จึงต้องแปลงก่อน
type InvoiceResponseItem = {
  id: string;
  invoiceNumber: string;
  status: string;
  version: number;
  billingMonth: string;
  room: { number: string; occupancies: Array<{ tenantProfile: { user: { displayName: string } } }> };
  items: Array<{ type: string; amount: string }>;
};

// ค่าเช่า ค่าน้ำ ค่าไฟ แยกช่องของตัวเอง ที่เหลือรวมเป็นค่าบริการอื่น ๆ ก้อนเดียว
const ownColumnTypes = new Set(["RENT", "WATER", "ELECTRICITY"]);

function toInvoice(item: InvoiceResponseItem): Invoice {
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
    service: item.items.filter((line) => !ownColumnTypes.has(line.type)).reduce((sum, line) => sum + Number(line.amount), 0),
    status: invoiceStatusOf(item.status),
  };
}

// ให้เซิร์ฟเวอร์กรองทั้งคำค้นและสถานะ บิลสะสมเยอะเกินจะโหลดมาทั้งหมด
async function requestInvoices({ page, propertyId, query, signal, statusFilter }: {
  page: number;
  propertyId: string;
  query: string;
  signal?: AbortSignal;
  statusFilter: string;
}) {
  const search = new URLSearchParams({ page: String(page), pageSize: "20", query: query.trim() });
  if (statusFilter !== "all") search.set("status", statusFilter.toUpperCase());
  const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices?${search}`, { cache: "no-store", signal });
  const payload = await readApiPayload<{
    data?: InvoiceResponseItem[];
    error?: string;
    requestId?: string;
    pageInfo?: ServerPageInfo;
    summary?: { draft: number; paid: number; pending: number; overdue: number; total: string };
  }>(response, "โหลดบิลไม่สำเร็จ");
  // ตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้ ต้องดักไว้ก่อน
  if (!payload.data || !payload.pageInfo || !payload.summary) throw new Error("ข้อมูลบิลที่ได้รับไม่ครบถ้วน");
  return { invoices: payload.data.map(toInvoice), pageInfo: payload.pageInfo, summary: payload.summary };
}

// สถานะในฐานข้อมูลเป็นตัวพิมพ์ใหญ่ ส่วนหน้าจอใช้ตัวพิมพ์เล็ก ที่ไม่อยู่ในรายการถือว่ารอชำระ
const invoiceStatusMap: Record<string, Invoice["status"]> = {
  DRAFT: "draft",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
};

function invoiceStatusOf(status: string): Invoice["status"] {
  return invoiceStatusMap[status] ?? "pending";
}

type InvoiceTableActions = Readonly<{
  actionFeedback: ReturnType<typeof useActionFeedback>;
  onCancel: (invoice: Invoice) => void;
  onIssue: (invoice: Invoice) => Promise<void>;
  onRequestPdf: (invoice: Invoice, action: "preview" | "generate") => Promise<void>;
  onReviewPayments: () => void;
  readOnly: boolean;
}>;

// รายการในเมนูขึ้นกับสถานะบิล ร่างยังออกบิลได้ ที่ออกไปแล้วเหลือแค่ตรวจการชำระ
function invoiceMenuItems({ actionFeedback, invoice, onCancel, onIssue, onRequestPdf, onReviewPayments, readOnly }: InvoiceTableActions & { invoice: Invoice }) {
  const items: ActionMenuItem[] = [
    { disabled: actionFeedback.isPending, icon: <Eye aria-hidden="true" size={16} />, id: "preview-pdf", label: "ดูตัวอย่างบิล (PDF)", onSelect: () => void onRequestPdf(invoice, "preview") },
  ];
  // ร่างยังไม่มีเลขบิลจริง จึงให้ดูตัวอย่างได้อย่างเดียว ยังดาวน์โหลดไม่ได้
  if (invoice.status !== "draft") {
    items.push({ disabled: actionFeedback.isPending, icon: <Download aria-hidden="true" size={16} />, id: "generate-pdf", label: "ดาวน์โหลด PDF บิล", onSelect: () => void onRequestPdf(invoice, "generate") });
  }
  // บิลที่ชำระแล้วหรือยกเลิกแล้วเป็นอันจบ ไม่มีอะไรให้ทำต่อ
  const settled = invoice.status === "paid" || invoice.status === "cancelled";
  if (readOnly || settled) return items;

  if (invoice.status === "draft") {
    items.push({ disabled: actionFeedback.isPending, icon: <ReceiptText aria-hidden="true" size={16} />, id: "issue", label: actionFeedback.isPending ? "กำลังออกบิล..." : "ออกบิล", onSelect: () => void onIssue(invoice) });
  } else {
    items.push({ icon: <CheckCircle2 aria-hidden="true" size={16} />, id: "review-payment", label: "ตรวจสอบหลักฐานการชำระ", onSelect: onReviewPayments });
  }
  items.push({ icon: <Ban aria-hidden="true" size={16} />, id: "cancel", label: "ยกเลิกบิล", onSelect: () => onCancel(invoice), variant: "danger" as const });
  return items;
}

function InvoiceTable({ invoices, ...actions }: InvoiceTableActions & Readonly<{ invoices: Invoice[] }>) {
  return <div className="figma-table-wrap">
    <table className="figma-grid-table invoice-table">
      <thead>
        {/* ช่องสุดท้ายเป็นเมนูจัดการ ไม่มีหัวข้อให้อ่าน จึงใส่ชื่อไว้ให้โปรแกรมอ่านหน้าจอเท่านั้น */}
        <tr className="figma-table-head"><th scope="col">เลขที่บิล</th><th scope="col">ห้อง</th><th scope="col">ผู้เช่า</th><th scope="col">ค่าเช่า</th><th scope="col">ค่าน้ำ</th><th scope="col">ค่าไฟ</th><th scope="col">ยอดรวม</th><th scope="col">สถานะ</th><th scope="col"><span className="sr-only">จัดการ</span></th></tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => <tr className="figma-table-row" data-status={invoice.status} key={invoice.id}>
          <td>{invoice.id}</td><td>{invoice.roomId}</td><td>{invoice.tenantName}</td>
          <td>{currency.format(invoice.rent)}</td><td>{currency.format(invoice.water)}</td><td>{currency.format(invoice.electricity)}</td>
          <td><strong>{currency.format(totalInvoice(invoice))}</strong></td>
          <td><em className={`figma-status ${getStatusClass(invoice.status)}`}>{statusText[invoice.status]}</em></td>
          <td><ActionMenu items={invoiceMenuItems({ ...actions, invoice })} label={`จัดการบิล ${invoice.id}`} /></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

// กล่องยกเลิกบิล บังคับกรอกเหตุผลอย่างน้อย 3 ตัวอักษร เพราะเหตุผลนี้ถูกเก็บไว้ในประวัติถาวร
function CancelInvoiceDialog({ invoice, isCancelling, onClose, onSubmit, reason, setReason }: Readonly<{
  invoice: Invoice | null;
  isCancelling: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  reason: string;
  setReason: (value: string) => void;
}>) {
  if (!invoice) return null;
  const reasonTooShort = !isCancelling && reason.trim().length < 3;

  return <Dialog ariaDescribedBy="invoice-cancel-description" ariaLabelledBy="invoice-cancel-title" className="modal-sm" onClose={onClose}>
    <header className="modal-header">
      <div>
        <h2 id="invoice-cancel-title">ยกเลิกบิล {invoice.id}</h2>
        <p id="invoice-cancel-description">บิลจะถูกเก็บไว้ในประวัติพร้อมเหตุผล และไม่สามารถนำไปชำระได้</p>
      </div>
      <IconButton disabled={isCancelling} label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างยกเลิกบิล"><X /></IconButton>
    </header>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
      <label>
        <span>เหตุผลที่ยกเลิก</span>
        <textarea autoFocus maxLength={500} minLength={3} onChange={(event) => setReason(event.target.value)} placeholder="เช่น ออกบิลผิดห้อง หรือยอดค่าใช้จ่ายไม่ถูกต้อง" required value={reason} />
      </label>
      <footer className="modal-actions">
        <button disabled={isCancelling} onClick={onClose} type="button">กลับ</button>
        <button aria-describedby={reasonTooShort ? "invoice-cancel-disabled-reason" : undefined} className="primary-button danger-confirm-button" disabled={isCancelling || reason.trim().length < 3} type="submit">{isCancelling ? "กำลังยกเลิก..." : "ยืนยันยกเลิกบิล"}</button>
      </footer>
      {reasonTooShort ? <p className="disabled-reason justify-self-end" id="invoice-cancel-disabled-reason">ระบุเหตุผลอย่างน้อย 3 ตัวอักษรก่อนยืนยัน</p> : null}
    </form>
  </Dialog>;
}

// การ์ดตัวเลขสรุปด้านบน ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function InvoiceSummary({ icon, label, tone, value }: Readonly<{ icon: React.ReactNode; label: string; tone: string; value: string }>) {
  return <article className={`figma-summary-card compact tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
