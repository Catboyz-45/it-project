"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Subscription Payment Review” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Search, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { createApiError, formatClientError } from "@/lib/client/api-error";
import { LoadMoreButton } from "@/components/ui/DataNavigation";
import { IconButton } from "@/components/ui/IconButton";
import { IconLink } from "@/components/ui/IconLink";
import { Dialog } from "@/components/ui/Dialog";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Payment” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Payment = {
  id: string; amount: string; mimeType: string; sizeBytes: number; submittedAt: string;
  order: { orderNumber: string; propertyId: string; planName: string; billingInterval: "MONTHLY" | "YEARLY"; type: "NEW" | "RENEWAL"; property: { name: string } };
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Subscription Payment Review” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SubscriptionPaymentReview() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const notify = useToast();

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const load = useCallback(async (targetPage = 1, append = false) => {
    setError(""); setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/super-admin/subscription-payments?page=${targetPage}&pageSize=20&query=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const payload = await response.json() as { data?: Payment[]; pageInfo?: { page: number; hasNextPage: boolean }; error?: string };
      if (!response.ok || !payload.data || !payload.pageInfo) throw new Error(payload.error || "โหลดรายการไม่สำเร็จ");
      setPayments((current) => append ? [...current, ...payload.data!] : payload.data!);
      setPage(payload.pageInfo.page); setHasNextPage(payload.pageInfo.hasNextPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดรายการไม่สำเร็จ"); }
    finally { setIsLoading(false); }
  }, [query]);
  useEffect(() => {   /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “timer” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
const timer = window.setTimeout(() => { void load(); }, 300); return () => window.clearTimeout(timer); }, [load]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “review” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - payment: ค่า “payment” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - note: ค่า “note” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function review(payment: Payment, status: "APPROVED" | "REJECTED", note?: string) {
    setPendingId(payment.id); setError("");
    try {
      const response = await fetch(`/api/v1/super-admin/subscription-payments/${payment.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(note ? { rejectionNote: note } : {}) }),
      });
      const payload = await response.json() as { error?: string; requestId?: string };
      if (!response.ok) throw createApiError(payload, "ตรวจสอบรายการไม่สำเร็จ");
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

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Rejection Dialog” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - payment: ค่า “payment” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  function openRejectionDialog(payment: Payment) {
    setError("");
    setRejectionNote("");
    setRejecting(payment);
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit Rejection” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  function submitRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = rejectionNote.trim();
    if (!rejecting || note.length < 2) return;
    void review(rejecting, "REJECTED", note);
  }

  const isReviewing = pendingId !== "";

  return <>
    <section className="panel overflow-hidden p-0">
      <div className="border-b border-[#e3e4e8] p-5"><h2 className="text-xl font-black">ตรวจสอบค่าสมาชิก SaaS</h2><p className="text-sm text-[#62646c]">อนุมัติแล้วระบบจะเปิดใช้หรือต่ออายุให้อัตโนมัติ</p></div>
      <label className="relative m-4 block"><span className="sr-only">ค้นหารายการชำระ</span><Search className="absolute top-1/2 left-3 -translate-y-1/2 text-[#73757d]" size={17} /><input className="w-full pl-10" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาหอ เลขคำสั่งซื้อ หรือแพ็กเกจ" value={query} /></label>
      {error && !rejecting ? <p className="form-alert error m-5" role="alert">{error}</p> : null}
        <div className="overflow-x-auto">{payments.length ? <table><thead><tr><th>หอพัก</th><th>คำสั่งซื้อ</th><th>แพ็กเกจ</th><th>ยอด</th><th>ส่งเมื่อ</th><th>ตรวจสอบ</th></tr></thead><tbody>{payments.map((payment) => <tr data-testid="subscription-payment-review" key={payment.id}><td>{payment.order.property.name}</td><td><strong>{payment.order.orderNumber}</strong><small className="block">{payment.order.type === "RENEWAL" ? "ต่ออายุ" : "สมัครใหม่"}</small></td><td>{payment.order.planName} · {payment.order.billingInterval === "YEARLY" ? "รายปี" : "รายเดือน"}</td><td>฿{Number(payment.amount).toLocaleString("th-TH")}</td><td>{new Date(payment.submittedAt).toLocaleString("th-TH")}</td><td><div className="flex gap-2"><IconLink href={`/api/v1/super-admin/subscription-payments/${payment.id}/slip`} label="เปิดสลิปค่าสมาชิก" rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={16} /></IconLink><IconButton disabled={isReviewing} label="อนุมัติค่าสมาชิก" onClick={() => void review(payment, "APPROVED")}><Check size={16} /></IconButton><IconButton disabled={isReviewing} label="ปฏิเสธค่าสมาชิก" onClick={() => openRejectionDialog(payment)} variant="danger"><X size={16} /></IconButton></div></td></tr>)}</tbody></table> : query.trim() ? <SearchEmptyState description="ลองใช้ชื่อหอ เลขคำสั่งซื้อ หรือแพ็กเกจอื่น" title="ไม่พบรายการที่ค้นหา" /> : <p className="p-8 text-center text-[#62646c]">ไม่มีรายการรอตรวจสอบ</p>}</div>
      {hasNextPage ? <LoadMoreButton isLoading={isLoading} onClick={() => void load(page + 1, true)} /> : null}
    </section>

    {rejecting ? <Dialog ariaDescribedBy="subscription-rejection-description" ariaLabelledBy="subscription-rejection-title" onClose={() => setRejecting(null)}>
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
