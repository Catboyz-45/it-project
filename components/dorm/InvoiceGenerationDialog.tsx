"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Invoice Generation Dialog” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FilePlus2, Files, Save, X } from "lucide-react";
import type { Room } from "@/types/dorm";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { DropdownField } from "@/components/dorm/DropdownField";
import { formatClientError, readApiData } from "@/lib/client/api-error";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Mode” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Mode = "single" | "bulk";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Step” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Step = 1 | 2 | 3;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Bulk Result” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type BulkResult = {
  created: Array<{ id: string; invoiceNumber: string; room: { number: string } }>;
  skipped: Array<{ roomId: string; roomNumber: string; reason: string }>;
};
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Preflight Result” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type PreflightResult = {
  ready: Array<{ roomId: string; roomNumber: string; tenantName: string; dueDate: string; subtotal: string; items: Array<{ type: string; description: string; quantity: string; unitPrice: string; amount: string }> }>;
  blocked: Array<{ roomId: string; roomNumber: string; reason: string }>;
  summary: { targetCount: number; readyCount: number; blockedCount: number; total: string };
};

const steps: Array<{ id: Step; label: string }> = [
  { id: 1, label: "เลือกขอบเขต" },
  { id: 2, label: "ตรวจข้อมูล" },
  { id: 3, label: "ยืนยันร่าง" },
];

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Response” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
async function parseResponse<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "บันทึกร่างบิลไม่สำเร็จ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Invoice Generation Dialog” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { initialMode, onChanged, onClose, propertyId, rooms, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function InvoiceGenerationDialog({
  initialMode,
  onChanged,
  onClose,
  propertyId,
  rooms,
}: {
  initialMode: Mode;
  onChanged: () => Promise<void>;
  onClose: () => void;
  propertyId: string;
  rooms: Room[];
}) {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “eligible Rooms” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const eligibleRooms = useMemo(() => rooms.filter((room) => room.status === "occupied" && room.databaseId), [rooms]);
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [roomId, setRoomId] = useState(eligibleRooms[0]?.databaseId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “selected Room” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - room: ค่า “room” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const selectedRoom = eligibleRooms.find((room) => room.databaseId === roomId);
  const targetCount = preflight?.summary.readyCount ?? (mode === "bulk" ? eligibleRooms.length : selectedRoom ? 1 : 0);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “go Next” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const goNext = async () => {
    setError("");
    if (!billingMonth || (mode === "single" && !roomId)) {
      setError("กรุณาเลือกเดือนและห้องที่ต้องการสร้างร่างบิล");
      return;
    }
    if (step === 1) {
      setIsSaving(true);
      try {
        const query = new URLSearchParams({ billingMonth, ...(mode === "single" ? { roomId } : {}) });
        const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices/preflight?${query}`, { cache: "no-store" });
        setPreflight(await parseResponse<PreflightResult>(response));
        setStep(2);
      } catch (previewError) {
        setError(formatClientError(previewError, "ตรวจความพร้อมของบิลไม่สำเร็จ"));
      } finally {
        setIsSaving(false);
      }
      return;
    }
    setStep((current) => Math.min(3, current + 1) as Step);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3) {
      void goNext();
      return;
    }
    setIsSaving(true);
    setError("");
    setResult(null);
    try {
      const bulk = mode === "bulk";
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices${bulk ? "/bulk" : ""}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth, issueImmediately: false, ...(bulk ? {} : { roomId }) }),
      });
      if (bulk) {
        const data = await parseResponse<BulkResult>(response);
        setResult(data);
        await onChanged();
      } else {
        await parseResponse(response);
        await onChanged();
        onClose();
      }
    } catch (submitError) {
      setError(formatClientError(submitError, "บันทึกร่างบิลไม่สำเร็จ"));
    } finally {
      setIsSaving(false);
    }
  };

  return <Dialog ariaDescribedBy="invoice-generation-description" ariaLabelledBy="invoice-generation-title" className="max-h-[90vh] overflow-y-auto" onClose={onClose}>
      <header className="modal-header">
        <div><p className="eyebrow">Draft-first billing</p><h2 id="invoice-generation-title">สร้างร่างบิล</h2><p id="invoice-generation-description">ตรวจข้อมูลเป็นขั้นตอนก่อนบันทึก ร่างบิลยังไม่แสดงให้ผู้เช่าเห็น</p></div>
        <IconButton disabled={isSaving} label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างสร้างบิล"><X /></IconButton>
      </header>

      <ol aria-label="ขั้นตอนสร้างร่างบิล" className="mx-5 mt-5 grid grid-cols-3 gap-2">
        {steps.map((item) => <li aria-current={step === item.id ? "step" : undefined} className={`rounded-xl border px-3 py-3 text-sm font-bold ${step === item.id ? "border-brand bg-brand/[.08] text-brand" : item.id < step ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#d7d8df] text-[#73757d]"}`} key={item.id}>
          <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-current/10">{item.id < step ? <Check size={14} /> : item.id}</span>{item.label}
        </li>)}
      </ol>

      <form className="modal-form" onSubmit={submit}>
        {step === 1 ? <section aria-labelledby="invoice-step-scope" className="grid gap-5">
          <div><h3 className="text-xl font-black" id="invoice-step-scope">1. เลือกขอบเขตการสร้าง</h3><p className="text-sm text-[#73757d]">เลือกสร้างให้ห้องเดียวหรือทุกห้องที่มีผู้เช่าหลัก</p></div>
          <div className="figma-inline-tabs invoice-tabs">
            <button className={mode === "single" ? "active" : ""} onClick={() => { setMode("single"); setPreflight(null); setError(""); }} type="button"><FilePlus2 size={17} /> ห้องเดียว</button>
            <button className={mode === "bulk" ? "active" : ""} onClick={() => { setMode("bulk"); setPreflight(null); setError(""); }} type="button"><Files size={17} /> ทั้งหอ</button>
          </div>
          <div className="modal-grid">
            <label><span>เดือนที่ออกบิล</span><input onChange={(event) => { setBillingMonth(event.target.value); setPreflight(null); }} required type="month" value={billingMonth} /></label>
            {mode === "single" ? <DropdownField label="ห้อง" onChange={(value) => { setRoomId(value); setPreflight(null); }} options={[{ label: "เลือกห้อง", value: "" }, ...eligibleRooms.flatMap((room) => room.databaseId ? [{ label: `ห้อง ${room.id} · ${room.tenantId ? "มีผู้เช่า" : "ตรวจสอบผู้เช่า"}`, value: room.databaseId }] : [])]} value={roomId} /> : <div className="modal-summary"><span>ขอบเขต</span><strong>{eligibleRooms.length} ห้องที่มีผู้เช่า</strong></div>}
          </div>
        </section> : null}

        {step === 2 ? <section aria-labelledby="invoice-step-readiness" className="grid gap-4">
          <div><h3 className="text-xl font-black" id="invoice-step-readiness">2. ตรวจความพร้อมของข้อมูล</h3><p className="text-sm text-[#73757d]">ระบบจะคำนวณค่าเช่า ค่าน้ำ และค่าไฟเมื่อบันทึกร่าง</p></div>
          <div className="grid gap-3 rounded-2xl border border-[#d7d8df] p-4">
            <CheckRow label="เดือนรอบบิล" value={billingMonth} />
            <CheckRow label="พร้อมสร้าง" value={`${preflight?.summary.readyCount ?? 0} จาก ${preflight?.summary.targetCount ?? 0} ห้อง`} />
            <CheckRow label="ยอดรวมโดยประมาณ" value={`฿${Number(preflight?.summary.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`} />
            <CheckRow label="สถานะเริ่มต้น" value="ฉบับร่าง · ผู้เช่ายังมองไม่เห็น" />
          </div>
          {preflight?.ready.length ? <div className="max-h-64 overflow-y-auto rounded-2xl border border-[#d7d8df]">{preflight.ready.map((item) => <div className="border-b border-[#e7e8eb] p-3 last:border-0" key={item.roomId}><div className="flex justify-between gap-3"><strong>ห้อง {item.roomNumber} · {item.tenantName}</strong><strong>฿{Number(item.subtotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div><small>{item.items.map((line) => `${line.description} ฿${Number(line.amount).toLocaleString("th-TH")}`).join(" · ")}</small></div>)}</div> : null}
          {preflight?.blocked.length ? <div className="form-alert error"><strong>สร้างไม่ได้ {preflight.blocked.length} ห้อง</strong>{preflight.blocked.map((item) => <span className="block" key={item.roomId}>ห้อง {item.roomNumber}: {item.reason}</span>)}</div> : null}
        </section> : null}

        {step === 3 ? <section aria-labelledby="invoice-step-confirm" className="grid gap-4">
          <div><h3 className="text-xl font-black" id="invoice-step-confirm">3. ยืนยันการบันทึกร่าง</h3><p className="text-sm text-[#73757d]">ยังไม่มีการส่งบิลหรือแจ้งผู้เช่าในขั้นตอนนี้</p></div>
          <div className="rounded-2xl bg-brand/[.06] p-5">
            <span className="text-sm text-[#73757d]">กำลังสร้าง</span>
            <strong className="mt-1 block text-2xl">ร่างบิล {targetCount} รายการ</strong>
            <p className="mt-2">รอบเดือน {billingMonth} · {mode === "single" ? `ห้อง ${selectedRoom?.id ?? "-"}` : "ทุกห้องที่พร้อม"}</p>
          </div>
          <p className="text-sm text-[#73757d]">หลังบันทึก คุณสามารถตรวจยอดและรายละเอียดของแต่ละร่างก่อนออกบิลให้ผู้เช่า</p>
        </section> : null}

        {error ? <div className="form-alert error" role="alert">{error}</div> : null}
        {result ? <section aria-live="polite" className="grid gap-3 rounded-2xl border border-[#d7d8df] p-4">
          <h3 className="text-xl font-black">บันทึกร่างเรียบร้อย</h3>
          <p><strong className="text-emerald-700">สำเร็จ {result.created.length} ห้อง</strong> · <strong className="text-amber-700">ข้าม {result.skipped.length} ห้อง</strong></p>
          {result.skipped.length ? <div className="max-h-52 overflow-y-auto">{result.skipped.map((item) => <div className="mb-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" key={item.roomId}><strong>ห้อง {item.roomNumber}</strong><span className="block">{item.reason}</span></div>)}</div> : null}
        </section> : null}

        <footer className="modal-actions">
          {result ? <button className="primary-button" onClick={onClose} type="button">เสร็จสิ้น</button> : <>
            <button disabled={isSaving} onClick={step === 1 ? onClose : () => { setError(""); setStep((current) => Math.max(1, current - 1) as Step); }} type="button">{step === 1 ? "ยกเลิก" : <><ChevronLeft size={17} /> ย้อนกลับ</>}</button>
            <button aria-describedby={!isSaving && (eligibleRooms.length === 0 || (mode === "single" && !roomId) || (step > 1 && targetCount === 0)) ? "invoice-generation-disabled-reason" : undefined} className="primary-button" disabled={isSaving || eligibleRooms.length === 0 || (mode === "single" && !roomId) || (step > 1 && targetCount === 0)} type="submit">
              {isSaving ? (step === 1 ? "กำลังตรวจข้อมูล..." : "กำลังบันทึกร่าง...") : step < 3 ? <>ถัดไป <ChevronRight size={17} /></> : <><Save size={17} /> บันทึกร่าง {targetCount} รายการ</>}
            </button>
          </>}
        </footer>
        {!result && !isSaving && eligibleRooms.length === 0 ? <p className="disabled-reason justify-self-end" id="invoice-generation-disabled-reason">ยังไม่มีห้องที่พร้อมสร้างบิล กรุณาตรวจผู้เช่า สัญญา และข้อมูลมิเตอร์ก่อน</p> : null}
        {!result && !isSaving && eligibleRooms.length > 0 && mode === "single" && !roomId ? <p className="disabled-reason justify-self-end" id="invoice-generation-disabled-reason">เลือกห้องที่ต้องการสร้างบิลก่อนดำเนินการต่อ</p> : null}
        {!result && !isSaving && eligibleRooms.length > 0 && !(mode === "single" && !roomId) && step > 1 && targetCount === 0 ? <p className="disabled-reason justify-self-end" id="invoice-generation-disabled-reason">ไม่มีรายการที่ผ่านการตรวจสอบสำหรับสร้างร่างบิล</p> : null}
      </form>
  </Dialog>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Check Row” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { label, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function CheckRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[#e7e8eb] pb-3 last:border-0 last:pb-0"><span className="text-sm text-[#73757d]">{label}</span><strong className="text-right">{value}</strong></div>;
}
