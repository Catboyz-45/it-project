"use client";
// โหลดรายการและส่งผลตรวจสอบจากเบราว์เซอร์

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Search, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { createApiError, formatClientError } from "@/lib/client/api-error";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import { IconButton } from "@/components/ui/IconButton";
import { IconLink } from "@/components/ui/IconLink";
import { Dialog } from "@/components/ui/Dialog";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";

// หลักฐานการโอนค่าสมาชิกที่เจ้าของหอส่งมา คนละเรื่องกับค่าเช่าที่ผู้เช่าจ่าย
export type Payment = {
  id: string; amount: string; mimeType: string; sizeBytes: number; submittedAt: string;
  order: { orderNumber: string; propertyId: string; planName: string; billingInterval: "MONTHLY" | "YEARLY"; type: "NEW" | "RENEWAL"; property: { name: string } };
};

// หน้าตรวจค่าสมาชิกของผู้ดูแลระบบ อนุมัติแล้วระบบเปิดใช้หรือต่ออายุแพ็กเกจให้อัตโนมัติ
// initialPayments ส่งมาจาก Server Component ของหน้านี้ คิวรอตรวจจึงมาพร้อม HTML
// ค้นหาและโหลดเพิ่มยังยิง API เหมือนเดิม
export function SubscriptionPaymentReview({
  initialHasNextPage = false,
  initialPayments = null,
}: {
  initialHasNextPage?: boolean;
  initialPayments?: Payment[] | null;
} = {}) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments ?? []);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const skipInitialLoadRef = useRef(initialPayments !== null);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const notify = useToast();

  const load = useCallback(async (targetPage = 1, append = false) => {
    setError(""); setIsLoading(true);
    try {
      // ส่งคำค้นไปให้เซิร์ฟเวอร์ ไม่ได้กรองในเครื่อง เพราะเป็นข้อมูลของทุกหอในระบบ
      const response = await fetch(`/api/v1/super-admin/subscription-payments?page=${targetPage}&pageSize=20&query=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const payload = await response.json() as { data?: Payment[]; pageInfo?: { page: number; hasNextPage: boolean }; error?: string };
      if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดรายการไม่สำเร็จ");
      setPayments((current) => append ? [...current, ...payload.data!] : payload.data!);
      setPage(payload.pageInfo.page); setHasNextPage(payload.pageInfo.hasNextPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดรายการไม่สำเร็จ"); }
    finally { setIsLoading(false); }
  }, [query]);
  // หน่วง 300 มิลลิวินาทีหลังหยุดพิมพ์ จะได้ไม่ยิงทุกครั้งที่กดแป้น
  useEffect(() => {
    // เซิร์ฟเวอร์ส่งคิวหน้าแรกมาแล้ว รอบแรกจึงข้ามไป
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => { void load(); }, 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function review(payment: Payment, status: "APPROVED" | "REJECTED", note?: string) {
    setPendingId(payment.id); setError("");
    try {
      const response = await fetch(`/api/v1/super-admin/subscription-payments/${payment.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(note ? { rejectionNote: note } : {}) }),
      });
      const payload = await response.json() as { error?: string; requestId?: string };
      if (!response.ok) throw createApiError(payload, "ตรวจสอบรายการไม่สำเร็จ");
      // ตัดออกจากรายการเลย ไม่ต้องโหลดใหม่ เพราะตรวจแล้วก็หลุดจากคิวรอตรวจอยู่ดี
      setPayments((current) => current.filter(({ id }) => id !== payment.id));
      setRejecting(null);
      setRejectionNote("");
      notify({ message: status === "APPROVED" ? "อนุมัติค่าสมาชิกแล้ว" : "ปฏิเสธหลักฐานค่าสมาชิกแล้ว" });
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

  function submitRejection(event: FormEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    const note = rejectionNote.trim();
    // บังคับกรอกเหตุผล เพราะเจ้าของหอต้องรู้ว่าต้องแก้อะไรก่อนส่งใหม่
    if (!rejecting || note.length < 2) return;
    void review(rejecting, "REJECTED", note);
  }

  // มีรายการไหนกำลังตรวจอยู่ก็ปิดปุ่มทั้งหมด กันกดซ้อนหลายรายการพร้อมกัน
  const isReviewing = pendingId !== "";

  return <>
    <section className="panel overflow-hidden p-0">
      <div className="border-b border-[#e4e4e7] p-5"><h2 className="text-base font-semibold">ตรวจสอบค่าสมาชิก SaaS</h2><p className="text-sm text-[#62646c]">อนุมัติแล้วระบบจะเปิดใช้หรือต่ออายุให้อัตโนมัติ</p></div>
      <label className="relative m-4 block"><span className="sr-only">ค้นหารายการชำระ</span><Search className="absolute top-1/2 left-3 -translate-y-1/2 text-[#62646c]" size={17} /><input className="w-full pl-10" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาหอ เลขคำสั่งซื้อ หรือแพ็กเกจ" value={query} /></label>
      {error && !rejecting ? <p className="form-alert error m-5" role="alert">{error}</p> : null}
        <div className="overflow-x-auto">{payments.length ? <table><thead><tr><th>หอพัก</th><th>คำสั่งซื้อ</th><th>แพ็กเกจ</th><th>ยอด</th><th>ส่งเมื่อ</th><th>ตรวจสอบ</th></tr></thead><tbody>{payments.map((payment) => <tr data-testid="subscription-payment-review" key={payment.id}><td>{payment.order.property.name}</td><td><strong>{payment.order.orderNumber}</strong><small className="block">{payment.order.type === "RENEWAL" ? "ต่ออายุ" : "สมัครใหม่"}</small></td><td>{payment.order.planName} · {payment.order.billingInterval === "YEARLY" ? "รายปี" : "รายเดือน"}</td><td>฿{Number(payment.amount).toLocaleString("th-TH")}</td><td>{new Date(payment.submittedAt).toLocaleString("th-TH")}</td><td><div className="flex gap-2"><IconLink href={`/api/v1/super-admin/subscription-payments/${payment.id}/slip`} label="เปิดสลิปค่าสมาชิก" rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={16} /></IconLink><IconButton disabled={isReviewing} label="อนุมัติค่าสมาชิก" onClick={() => void review(payment, "APPROVED")}><Check size={16} /></IconButton><IconButton disabled={isReviewing} label="ปฏิเสธค่าสมาชิก" onClick={() => openRejectionDialog(payment)} variant="danger"><X size={16} /></IconButton></div></td></tr>)}</tbody></table> : query.trim() ? <SearchEmptyState description="ลองใช้ชื่อหอ เลขคำสั่งซื้อ หรือแพ็กเกจอื่น" title="ไม่พบรายการที่ค้นหา" /> : <p className="p-8 text-center text-[#62646c]">ไม่มีรายการรอตรวจสอบ</p>}</div>
      {hasNextPage ? <LoadMoreButton isLoading={isLoading} onClick={() => void load(page + 1, true)} /> : null}
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
