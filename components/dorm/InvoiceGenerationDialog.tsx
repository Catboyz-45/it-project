"use client";
// เก็บสถานะของตัวช่วยทีละขั้นและยิงคำขอจากเบราว์เซอร์

import { FormEvent, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FilePlus2, Files, Save, X } from "lucide-react";
import type { Room } from "@/types/dorm";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { DropdownField } from "@/components/dorm/DropdownField";
import { formatClientError, readApiData } from "@/lib/client/api-error";

// สร้างทีละห้อง หรือสร้างให้ทุกห้องที่พร้อมในครั้งเดียว
type Mode = "single" | "bulk";
// เลือกขอบเขต ตรวจข้อมูล แล้วยืนยัน
type Step = 1 | 2 | 3;
// ผลของการสร้างทั้งหอ บางห้องสร้างได้ บางห้องถูกข้ามพร้อมเหตุผล
type BulkResult = {
  created: Array<{ id: string; invoiceNumber: string; room: { number: string } }>;
  skipped: Array<{ roomId: string; roomNumber: string; reason: string }>;
};
// ผลการตรวจก่อนสร้างจริง ให้ผู้ใช้เห็นยอดและปัญหาก่อนตัดสินใจ
type PreflightResult = {
  ready: Array<{ roomId: string; roomNumber: string; tenantName: string; dueDate: string; subtotal: string; items: Array<{ type: string; description: string; quantity: string; unitPrice: string; amount: string }> }>;
  blocked: Array<{ roomId: string; roomNumber: string; reason: string }>;
  summary: { targetCount: number; readyCount: number; blockedCount: number; total: string };
};

// ป้ายของแต่ละขั้น แยกออกมาเป็นข้อมูล จะได้วนสร้างแถบขั้นตอนได้เลย
const steps: Array<{ id: Step; label: string }> = [
  { id: 1, label: "เลือกขอบเขต" },
  { id: 2, label: "ตรวจข้อมูล" },
  { id: 3, label: "ยืนยันร่าง" },
];

// ห่อ readApiData ไว้ให้ข้อความผิดพลาดของทั้งไฟล์นี้เหมือนกันหมด
async function parseResponse<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "บันทึกร่างบิลไม่สำเร็จ");
}

// ตัวช่วยสร้างร่างบิลแบบสามขั้น ร่างที่สร้างยังไม่ส่งถึงผู้เช่า ต้องมากดออกบิลอีกที
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
  // ออกบิลได้เฉพาะห้องที่มีคนอยู่ และต้องมี databaseId เพราะบางห้องเป็นข้อมูลที่ยังไม่บันทึกลงฐาน
  const eligibleRooms = useMemo(() => rooms.filter((room) => room.status === "occupied" && room.databaseId), [rooms]);
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode>(initialMode);
  // ตั้งต้นเป็นเดือนปัจจุบันในรูปแบบ YYYY-MM ซึ่งตรงกับที่ input type="month" ต้องการ
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [roomId, setRoomId] = useState(eligibleRooms[0]?.databaseId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const selectedRoom = eligibleRooms.find((room) => room.databaseId === roomId);
  // ตรวจแล้วก็ใช้ตัวเลขจริงจากเซิร์ฟเวอร์ ยังไม่ตรวจก็ประมาณจากที่ผู้ใช้เลือกไว้
  const targetCount = preflight?.summary.readyCount ?? (mode === "bulk" ? eligibleRooms.length : selectedRoom ? 1 : 0);

  // ขั้น 1 ต้องเรียกเซิร์ฟเวอร์ตรวจก่อน ขั้นอื่นแค่เลื่อนไปข้างหน้าเฉย ๆ
  const goNext = async () => {
    setError("");
    if (!billingMonth || (mode === "single" && !roomId)) {
      setError("กรุณาเลือกเดือนและห้องที่ต้องการสร้างร่างบิล");
      return;
    }
    if (step === 1) {
      setIsSaving(true);
      try {
        // URLSearchParams จัดการ escape ให้เอง ปลอดภัยกว่าต่อสตริงเอง
        const query = new URLSearchParams({ billingMonth, ...(mode === "single" ? { roomId } : {}) });
        const response = await fetch(`/api/v1/admin/properties/${propertyId}/invoices/preflight?${query}`, { cache: "no-store" });
        // ไปขั้นถัดไปเมื่อตรวจสำเร็จเท่านั้น ตรวจพลาดต้องให้แก้แล้วลองใหม่ที่ขั้นเดิม
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault();
    // ยังไม่ถึงขั้นสุดท้าย การกด Enter คือไปขั้นถัดไป ไม่ใช่สร้างบิลเลย
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
        // issueImmediately: false คือหัวใจของที่นี่ สร้างเป็นร่างไว้ก่อน ผู้เช่ายังไม่เห็น
        body: JSON.stringify({ billingMonth, issueImmediately: false, ...(bulk ? {} : { roomId }) }),
      });
      // สร้างทั้งหอต้องค้างกล่องไว้ให้ดูว่าห้องไหนถูกข้าม ส่วนห้องเดียวปิดได้เลย
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

      {/* ใช้ ol เพราะเป็นลำดับขั้นจริง ๆ ไม่ใช่แค่กล่องสามกล่องเรียงกัน */}
      <ol aria-label="ขั้นตอนสร้างร่างบิล" className="mx-5 mt-5 grid grid-cols-3 gap-2">
        {/* aria-current="step" บอกโปรแกรมอ่านหน้าจอว่าอยู่ขั้นไหน ไม่ใช่แค่ทำให้สีต่าง */}
        {steps.map((item) => <li aria-current={step === item.id ? "step" : undefined} className={`rounded-xl border px-3 py-3 text-sm font-bold ${step === item.id ? "border-brand bg-brand/[.08] text-brand" : item.id < step ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#d7d8df] text-[#73757d]"}`} key={item.id}>
          <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-current/10">{item.id < step ? <Check size={14} /> : item.id}</span>{item.label}
        </li>)}
      </ol>

      <form className="modal-form" onSubmit={submit}>
        {step === 1 ? <section aria-labelledby="invoice-step-scope" className="grid gap-5">
          <div><h3 className="text-xl font-black" id="invoice-step-scope">1. เลือกขอบเขตการสร้าง</h3><p className="text-sm text-[#73757d]">เลือกสร้างให้ห้องเดียวหรือทุกห้องที่มีผู้เช่าหลัก</p></div>
          <div className="figma-inline-tabs invoice-tabs">
            {/* เปลี่ยนโหมดแล้วต้องล้างผลตรวจเก่าทิ้ง ไม่งั้นจะเอายอดของโหมดก่อนหน้ามาแสดง */}
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
          {/* บอกให้ครบว่าห้องไหนสร้างไม่ได้เพราะอะไร จะได้ไปแก้ถูกจุด */}
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
        {/* aria-live ให้โปรแกรมอ่านหน้าจออ่านผลลัพธ์เอง เพราะขึ้นมาหลังกดไปแล้ว */}
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
        {/* ปุ่มที่กดไม่ได้ต้องบอกเหตุผลด้วย แยกสามกรณีเพราะวิธีแก้ไม่เหมือนกัน */}
        {!result && !isSaving && eligibleRooms.length === 0 ? <p className="disabled-reason justify-self-end" id="invoice-generation-disabled-reason">ยังไม่มีห้องที่พร้อมสร้างบิล กรุณาตรวจผู้เช่า สัญญา และข้อมูลมิเตอร์ก่อน</p> : null}
        {!result && !isSaving && eligibleRooms.length > 0 && mode === "single" && !roomId ? <p className="disabled-reason justify-self-end" id="invoice-generation-disabled-reason">เลือกห้องที่ต้องการสร้างบิลก่อนดำเนินการต่อ</p> : null}
        {!result && !isSaving && eligibleRooms.length > 0 && !(mode === "single" && !roomId) && step > 1 && targetCount === 0 ? <p className="disabled-reason justify-self-end" id="invoice-generation-disabled-reason">ไม่มีรายการที่ผ่านการตรวจสอบสำหรับสร้างร่างบิล</p> : null}
      </form>
  </Dialog>;
}

// แถวชื่อคู่ค่าในหน้าตรวจข้อมูล ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function CheckRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[#e7e8eb] pb-3 last:border-0 last:pb-0"><span className="text-sm text-[#73757d]">{label}</span><strong className="text-right">{value}</strong></div>;
}
