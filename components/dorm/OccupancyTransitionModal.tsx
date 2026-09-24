"use client";
// เก็บค่าที่กรอกในฟอร์มและยิงคำขอจากเบราว์เซอร์

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, CheckCircle2, LoaderCircle, LogOut, Plus, RefreshCw, Trash2, X, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";
import { DatePickerField } from "@/components/dorm/DatePickerField";
import { DropdownField } from "@/components/dorm/DropdownField";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { Dialog } from "@/components/ui/Dialog";
import { currency } from "@/lib/dorm-utils";
import type { Room, Tenant } from "@/types/dorm";
import { ownerPagePath } from "@/lib/navigation-routes";

// เก็บจำนวนเงินเป็นสตริงเพราะมาจากช่องกรอก ค่อยแปลงเป็นตัวเลขตอนคำนวณกับตอนส่ง
// id สร้างฝั่งเบราว์เซอร์ไว้ใช้เป็น key ของแถว ไม่ได้ส่งขึ้นเซิร์ฟเวอร์
type Deduction = { id: string; label: string; amount: string };
// ผลตรวจจากเซิร์ฟเวอร์ว่าย้ายออกได้หรือยัง ไม่ให้ฝั่งเบราว์เซอร์เดาเอง
type MoveOutReadiness = {
  billingMonth: string;
  meters: { ready: boolean; waterRecordedAt: string | null; electricityRecordedAt: string | null };
  invoice: { ready: boolean; invoiceNumber: string | null; status: string | null };
  ready: boolean;
};

// ส่งกลับให้หน้าแม่หลังย้ายห้องสำเร็จ เพื่อเปิดฟอร์มสัญญาใหม่ที่กรอกไว้ให้แล้ว
export type MoveRoomLeaseDraft = {
  depositAmount: number;
  monthlyRent: number;
  roomId: string;
  startDate: string;
};

// กล่องย้ายออกกับย้ายห้อง สองงานนี้ใช้ฟอร์มเดียวกันเพราะต้องสรุปเงินประกันเหมือนกัน
type TransitionType = "MOVE_OUT" | "MOVE_ROOM";

// ตรวจฟอร์มทั้งชุด คืนข้อความว่างเมื่อกรอกครบและถูกต้อง
// ใช้ทั้งตอนกดตรวจสอบและตอนกดยืนยันจริง เพราะสองจังหวะนั้นแยกกัน
function transitionProblem({ deductions, destinationRoomId, reason, readiness, roomInspected, type }: {
  deductions: Deduction[];
  destinationRoomId: string;
  reason: string;
  readiness: MoveOutReadiness | null;
  roomInspected: boolean;
  type: TransitionType;
}) {
  if (type === "MOVE_ROOM" && !destinationRoomId) return "กรุณาเลือกห้องปลายทางและระบุเหตุผล";
  if (!reason.trim()) return type === "MOVE_ROOM" ? "กรุณาเลือกห้องปลายทางและระบุเหตุผล" : "กรุณาระบุเหตุผล";
  if (deductions.some(isInvalidDeduction)) return "กรุณาตรวจสอบรายการหักเงินประกัน";
  // ย้ายออกต้องครบทั้งสามอย่าง ระบบตรวจสองอย่างแรกให้ ส่วนการตรวจห้องต้องมีคนยืนยัน
  if (type === "MOVE_OUT" && (!readiness?.ready || !roomInspected)) {
    return "กรุณาทำรายการย้ายออกให้ครบ: มิเตอร์สุดท้าย บิลสุดท้าย และตรวจสภาพห้อง";
  }
  return "";
}

function isInvalidDeduction(item: Deduction) {
  const amount = Number(item.amount);
  return !item.label.trim() || amount < 0 || !Number.isFinite(amount);
}

// บันทึกการย้ายออกหรือย้ายห้อง คืนยอดเงินประกันที่ถูกโอนไปห้องใหม่
async function submitTransitionRequest({ deductions, destinationRoomId, effectiveDate, note, propertyId, reason, tenantId, type }: {
  deductions: Deduction[];
  destinationRoomId: string;
  effectiveDate: string;
  note: string;
  propertyId: string;
  reason: string;
  tenantId: string;
  type: TransitionType;
}) {
  const response = await fetch(`/api/v1/admin/properties/${propertyId}/tenants/${tenantId}/transitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      ...(type === "MOVE_ROOM" ? { destinationRoomId } : {}),
      effectiveDate,
      reason,
      settlementNote: settlementNoteOf(note, type),
      deductions: deductions.map((item) => ({ label: item.label, amount: Number(item.amount) })),
    }),
  });
  const payload = await response.json() as { data?: { transferredAmount: number }; error?: string };
  if (!response.ok) throw new Error(payload.error || "ดำเนินการไม่สำเร็จ");
  if (type !== "MOVE_ROOM") return 0;
  // ย้ายห้องต้องรู้ยอดที่โอนไป ไม่งั้นสัญญาใหม่จะกรอกเงินประกันไม่ถูก
  if (!payload.data) throw new Error("ไม่พบข้อมูลยอดเงินประกันที่โอนไปห้องใหม่");
  return payload.data.transferredAmount;
}

// แนบผลตรวจไว้ในหมายเหตุ เพื่อให้ประวัติบอกได้ว่าตอนนั้นตรวจอะไรผ่านมาบ้าง
function settlementNoteOf(note: string, type: TransitionType) {
  if (type !== "MOVE_OUT") return note || undefined;
  const checkedMark = "[ตรวจจากระบบ: มิเตอร์และบิลสุดท้ายครบ, ผู้ใช้ยืนยันตรวจสภาพห้อง]";
  return note ? `${checkedMark} ${note}` : checkedMark;
}

// รายการหักเงินประกัน ค่าค้างชำระจากบิลจะถูกระบบรวมให้อัตโนมัติอยู่แล้ว
function DeductionSection({ deductions, deductionTotal, deposit, preliminaryBalance, setDeductions }: Readonly<{
  deductions: Deduction[];
  deductionTotal: number;
  deposit: number;
  preliminaryBalance: number;
  setDeductions: React.Dispatch<React.SetStateAction<Deduction[]>>;
}>) {
  const editRow = (index: number, patch: Partial<Deduction>) => {
    setDeductions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  return <section className="rounded-2xl border border-[#d9dae0] p-4">
    <div className="mb-3 flex items-center justify-between">
      <div><strong>รายการหักเงินประกัน</strong><p className="text-sm opacity-60">ค่าค้างชำระจากบิลจะถูกระบบรวมให้อัตโนมัติ</p></div>
      <button className="secondary-button" onClick={() => setDeductions((current) => [...current, { id: crypto.randomUUID(), label: "", amount: "" }])} type="button"><Plus size={16} /> เพิ่มรายการ</button>
    </div>
    <div className="grid gap-2">{deductions.map((item, index) => <div className="grid grid-cols-[1fr_160px_44px] gap-2" key={item.id}>
      <input aria-label={`รายละเอียดรายการหัก ${index + 1}`} maxLength={160} onChange={(event) => editRow(index, { label: event.target.value })} placeholder="เช่น ค่าทำความสะอาด" value={item.label} />
      <input aria-label={`จำนวนเงินรายการหัก ${index + 1}`} min="0" onChange={(event) => editRow(index, { amount: event.target.value })} placeholder="บาท" step="0.01" type="number" value={item.amount} />
      <IconButton label="ลบรายการ" onClick={() => setDeductions((current) => current.filter((_, rowIndex) => rowIndex !== index))} variant="danger"><Trash2 size={16} /></IconButton>
    </div>)}</div>
    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
      <div><span className="block opacity-60">เงินประกัน</span><strong>{currency.format(deposit)}</strong></div>
      <div><span className="block opacity-60">รายการหัก</span><strong>{currency.format(deductionTotal)}</strong></div>
      <div><span className="block opacity-60">คงเหลือเบื้องต้น</span><strong>{currency.format(preliminaryBalance)}</strong></div>
    </div>
  </section>;
}

// สองข้อแรกระบบตรวจให้ ข้อสามต้องมีคนไปดูห้องจริง จึงเป็นช่องติ๊กเอง
function MoveOutChecklist({ billingMonth, isChecking, onRecheck, propertyId, readiness, readinessError, roomInspected, setRoomInspected }: Readonly<{
  billingMonth: string;
  isChecking: boolean;
  onRecheck: () => Promise<void>;
  propertyId: string;
  readiness: MoveOutReadiness | null;
  readinessError: string;
  roomInspected: boolean;
  setRoomInspected: (checked: boolean) => void;
}>) {
  // จดน้ำแล้วก็พาไปหน้ามิเตอร์ไฟต่อ ยังไม่จดอะไรเลยก็เริ่มที่มิเตอร์น้ำ
  const meterPage = readiness?.meters.waterRecordedAt ? "electricMeter" : "waterMeter";
  const meterHelp = readiness?.meters.ready
    ? "พบมิเตอร์น้ำและไฟของเดือนที่ย้ายออกแล้ว"
    : "ต้องบันทึกทั้งมิเตอร์น้ำและไฟของเดือนที่ย้ายออก";
  const invoiceHelp = readiness?.invoice.ready
    ? `พบบิล ${readiness.invoice.invoiceNumber}`
    : "ต้องสร้างและออกบิลสุดท้ายให้พ้นสถานะฉบับร่าง";

  return <section className="rounded-2xl border border-brand/20 bg-brand/5 p-4">
    <strong>Checklist ก่อนย้ายออก</strong>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm opacity-60">ระบบตรวจข้อมูลของเดือน {billingMonth} จากฐานข้อมูล</p>
      <button className="secondary-button" disabled={isChecking} onClick={() => void onRecheck()} type="button">
        <RefreshCw className={isChecking ? "animate-spin" : ""} size={16} /> ตรวจอีกครั้ง
      </button>
    </div>
    <div className="grid gap-3">
      <ReadinessRow action="เปิดหน้ามิเตอร์" help={meterHelp} loading={isChecking} onAction={() => window.open(ownerPagePath(propertyId, meterPage), "_blank", "noopener,noreferrer")} ready={Boolean(readiness?.meters.ready)} title="1. มิเตอร์น้ำและไฟครั้งสุดท้าย" />
      <ReadinessRow action="เปิดหน้าบิล" help={invoiceHelp} loading={isChecking} onAction={() => window.open(ownerPagePath(propertyId, "invoices"), "_blank", "noopener,noreferrer")} ready={Boolean(readiness?.invoice.ready)} title="2. บิลสุดท้าย" />
      <label className="flex items-start gap-3 rounded-xl border border-[#d9dae0] bg-white/50 p-3">
        <input aria-label="ยืนยันว่าตรวจสภาพห้องและบันทึกรายการหักแล้ว" checked={roomInspected} className="mt-1 size-4" onChange={(event) => setRoomInspected(event.target.checked)} type="checkbox" />
        <span><strong className="block text-sm">3. ตรวจสภาพห้องและรายการหัก</strong><small className="opacity-60">ส่วนนี้ต้องยืนยันด้วยผู้ตรวจห้อง เพิ่มความเสียหายในรายการหักด้านบน</small></span>
      </label>
    </div>
    {readinessError ? <p className="form-alert error mt-3" role="alert">{readinessError}</p> : null}
  </section>;
}

// เลือกว่าจะย้ายออกหรือย้ายห้อง พร้อมวันที่มีผล ห้องปลายทาง และเหตุผล
function TransitionScopeFields({ destinationRoomId, destinationRooms, effectiveDate, reason, setDestinationRoomId, setEffectiveDate, setReason, setType, type }: Readonly<{
  destinationRoomId: string;
  destinationRooms: Room[];
  effectiveDate: string;
  reason: string;
  setDestinationRoomId: (roomId: string) => void;
  setEffectiveDate: (value: string) => void;
  setReason: (value: string) => void;
  setType: (type: TransitionType) => void;
  type: TransitionType;
}>) {
  // ห้องที่ยังไม่มี databaseId คือข้อมูลที่ยังไม่ถูกบันทึกลงฐาน เลือกไปก็ย้ายไม่ได้
  const roomOptions = [
    { label: "เลือกห้องว่าง", value: "" },
    ...destinationRooms.flatMap((room) => room.databaseId ? [{ label: `${room.id} · ${currency.format(room.rent)}/เดือน`, value: room.databaseId }] : []),
  ];

  return <>
    <div className="grid grid-cols-2 gap-3">
      <button className={`rounded-2xl border p-4 text-left ${type === "MOVE_OUT" ? "border-brand bg-brand/10" : "border-[#d9dae0]"}`} onClick={() => setType("MOVE_OUT")} type="button">
        <LogOut className="mb-2" /><strong className="block">ย้ายออก</strong><small>สิ้นสุดสัญญาและสรุปยอดคืนเงินประกัน</small>
      </button>
      <button className={`rounded-2xl border p-4 text-left ${type === "MOVE_ROOM" ? "border-brand bg-brand/10" : "border-[#d9dae0]"}`} onClick={() => setType("MOVE_ROOM")} type="button">
        <ArrowRightLeft className="mb-2" /><strong className="block">ย้ายห้อง</strong><small>ย้ายผู้พักทั้งห้องและโอนเงินประกันคงเหลือ</small>
      </button>
    </div>
    <div className="tenant-config-grid">
      {/* เพดานเป็นวันนี้ เพราะย้ายออกในอนาคตต้องรอให้ถึงวันจริงก่อน จะได้ไม่ปิดสัญญาล่วงหน้า
          ส่วนวันต่ำสุดเปิดกว้างไว้ เพราะย้ายออกไปแล้วเพิ่งมาบันทึกย้อนหลังได้ */}
      <DatePickerField label="วันที่มีผล" maxDate={new Date()} minDate={new Date(2000, 0, 1)} onChange={setEffectiveDate} value={effectiveDate} />
      {type === "MOVE_ROOM" ? <DropdownField label="ห้องปลายทาง" onChange={setDestinationRoomId} options={roomOptions} value={destinationRoomId} /> : null}
      <label className="full-width">
        <span>เหตุผล</span>
        <textarea maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={type === "MOVE_OUT" ? "เช่น ครบกำหนดสัญญา" : "เช่น ต้องการห้องขนาดใหญ่ขึ้น"} required value={reason} />
      </label>
    </div>
  </>;
}

export function OccupancyTransitionModal({ onClose, onCompleted, propertyId, rooms, tenant }: Readonly<{
  onClose: () => void;
  onCompleted: (leaseDraft?: MoveRoomLeaseDraft) => Promise<void>;
  propertyId: string;
  rooms: Room[];
  tenant: Tenant;
}>) {
  const notify = useToast();
  const [type, setType] = useState<"MOVE_OUT" | "MOVE_ROOM">("MOVE_OUT");
  const [destinationRoomId, setDestinationRoomId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [roomInspected, setRoomInspected] = useState(false);
  const [readiness, setReadiness] = useState<MoveOutReadiness | null>(null);
  const [readinessError, setReadinessError] = useState("");
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const { confirm, confirmationDialog: discardDialog } = useConfirmation();
  // || 0 กันช่องที่ยังว่างหรือกรอกไม่เป็นตัวเลข ทำให้ยอดรวมกลายเป็น NaN
  const deductionTotal = useMemo(() => deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [deductions]);
  // ไม่ให้ติดลบ หักเกินเงินประกันก็แค่คืน 0 ส่วนที่เกินเป็นหนี้ที่ต้องตามเก็บต่างหาก
  // เรียกว่าเบื้องต้นเพราะยอดจริงเซิร์ฟเวอร์เป็นคนคิด โดยรวมค่าค้างชำระจากบิลเข้าไปด้วย
  const preliminaryBalance = Math.max(tenant.deposit - deductionTotal, 0);
  // ห้องปลายทางต้องว่าง ไม่ใช่ห้องเดิม และต้องมีอยู่ในฐานข้อมูลจริง
  const destinationRooms = rooms.filter((room) => room.status === "available" && room.id !== tenant.roomId && room.databaseId);
  // นับว่าแก้แล้วถ้าแตะอะไรก็ตาม ใช้ตัดสินว่าต้องถามก่อนปิดหรือไม่
  const isDirty = destinationRoomId !== "" || reason !== "" || note !== "" || deductions.length > 0 || type !== "MOVE_OUT" || roomInspected;

  // ถามเซิร์ฟเวอร์ว่ามิเตอร์กับบิลสุดท้ายครบหรือยัง ย้ายห้องไม่ต้องตรวจเพราะสัญญายังไม่จบ
  const loadReadiness = useCallback(async () => {
    if (type !== "MOVE_OUT") return;
    setIsCheckingReadiness(true);
    setReadinessError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tenants/${tenant.id}/transitions?effectiveDate=${encodeURIComponent(effectiveDate)}`, { cache: "no-store" });
      const payload = await response.json() as { data?: MoveOutReadiness; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "ตรวจสอบข้อมูลก่อนย้ายออกไม่สำเร็จ");
      setReadiness(payload.data);
    } catch (cause) {
      setReadiness(null);
      setReadinessError(cause instanceof Error ? cause.message : "ตรวจสอบข้อมูลก่อนย้ายออกไม่สำเร็จ");
    } finally { setIsCheckingReadiness(false); }
  }, [effectiveDate, propertyId, tenant.id, type]);
  // ตรวจใหม่ทุกครั้งที่เปลี่ยนวันที่มีผล เพราะคนละเดือนก็คนละบิลคนละมิเตอร์
  useEffect(() => { void loadReadiness(); }, [loadReadiness]);
  // ยังไม่ได้แก้อะไรก็ปิดไปเลย แก้แล้วต้องถามก่อน ไม่งั้นกดพลาดแล้วที่กรอกไว้หายหมด
  const requestClose = useCallback(() => {
    if (!isDirty) return onClose();
    void confirm({ title: "ทิ้งข้อมูลที่ยังไม่บันทึก?", description: "รายการในแบบฟอร์มย้ายออก/ย้ายห้องจะหายไป", confirmLabel: "ทิ้งข้อมูล" }).then((accepted) => { if (accepted) onClose(); });
  }, [confirm, isDirty, onClose]);
  // เตือนอีกชั้นตอนผู้ใช้กดปิดแท็บหรือกดย้อนกลับของเบราว์เซอร์
  useUnsavedChanges(isDirty);

  // ตรวจให้ครบก่อนเปิดกล่องยืนยัน ผู้ใช้จะได้ไม่กดยืนยันแล้วเจอปฏิเสธทีหลัง
  const requestConfirmation = () => {
    const problem = transitionProblem({ deductions, destinationRoomId, reason, readiness, roomInspected, type });
    setError(problem);
    if (!problem) setIsConfirming(true);
  };

  // ตรวจซ้ำอีกรอบตรงนี้ เพราะ requestConfirmation กับ submit ถูกเรียกคนละจังหวะ
  const submit = async () => {
    const problem = transitionProblem({ deductions, destinationRoomId, reason, readiness, roomInspected, type });
    if (problem) {
      setError(problem);
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const transferredAmount = await submitTransitionRequest({
        deductions, destinationRoomId, effectiveDate, note, propertyId, reason, tenantId: tenant.id, type,
      });
      const destinationRoom = destinationRooms.find((room) => room.databaseId === destinationRoomId);
      // ส่งร่างสัญญาใหม่กลับไปเฉพาะตอนย้ายห้อง ย้ายออกไม่มีสัญญาต่อ
      await onCompleted(type === "MOVE_ROOM" ? {
        depositAmount: transferredAmount,
        monthlyRent: destinationRoom?.rent ?? tenant.monthlyRent ?? 0,
        roomId: destinationRoomId,
        startDate: effectiveDate,
      } : undefined);
      notify({ message: type === "MOVE_ROOM" ? "ย้ายห้องและโอนยอดเงินประกันแล้ว" : "ย้ายออกและสรุปเงินประกันแล้ว" });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return <><Dialog ariaDescribedBy="occupancy-transition-description" ariaLabelledBy="occupancy-transition-title" backdropClassName="z-[80]" className="max-w-3xl" onClose={requestClose}>
      <header className="modal-header"><div><p className="eyebrow" id="occupancy-transition-description">Occupancy workflow</p><h2 id="occupancy-transition-title">{tenant.name} · ห้อง {tenant.roomId}</h2></div><IconButton label="ปิด" onClick={requestClose}><X aria-hidden="true" /></IconButton></header>
      <div className="grid gap-5 p-6">
        <TransitionScopeFields
          destinationRoomId={destinationRoomId}
          destinationRooms={destinationRooms}
          effectiveDate={effectiveDate}
          reason={reason}
          setDestinationRoomId={setDestinationRoomId}
          setEffectiveDate={setEffectiveDate}
          setReason={setReason}
          setType={setType}
          type={type}
        />
        <DeductionSection deductions={deductions} deductionTotal={deductionTotal} deposit={tenant.deposit} preliminaryBalance={preliminaryBalance} setDeductions={setDeductions} />
        {type === "MOVE_OUT" ? <MoveOutChecklist
          billingMonth={readiness?.billingMonth ?? effectiveDate.slice(0, 7)}
          isChecking={isCheckingReadiness}
          onRecheck={loadReadiness}
          propertyId={propertyId}
          readiness={readiness}
          readinessError={readinessError}
          roomInspected={roomInspected}
          setRoomInspected={setRoomInspected}
        /> : null}
        <label><span>หมายเหตุการชำระ/คืนเงิน</span><textarea maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="เช่น คืนผ่านบัญชีธนาคารภายใน 7 วัน" value={note} /></label>
        {error ? <p className="form-alert error" role="alert">{error}</p> : null}
        <p className="form-alert" role="status">เมื่อยืนยัน ระบบจะปิดสัญญาเดิมและการเข้าพักทันที {type === "MOVE_ROOM" ? "จากนั้นระบบจะเปิดฟอร์มสร้างสัญญาห้องใหม่พร้อมกรอกข้อมูลเดิมให้" : "ระบบจะบันทึกสรุปการย้ายออกและเงินประกันไว้ในประวัติ"}</p>
      </div>
      <footer className="modal-actions"><button className="secondary-button" disabled={isSubmitting} onClick={requestClose} type="button">ยกเลิก</button><button className="primary-button" disabled={isSubmitting} onClick={requestConfirmation} type="button">{transitionSubmitLabel(isSubmitting, type)}</button></footer>
    </Dialog>
    {/* ถามยืนยันแยกอีกชั้น เพราะกดแล้วสัญญาปิดทันทีและย้อนกลับไม่ได้ */}
    {isConfirming ? <ConfirmationDialog
      confirmDisabled={isSubmitting || (type === "MOVE_OUT" && (!readiness?.ready || !roomInspected))}
      confirmLabel={type === "MOVE_ROOM" ? "ยืนยันย้ายห้อง" : "ยืนยันย้ายออก"}
      description={type === "MOVE_ROOM" ? `ระบบจะปิดสัญญาห้อง ${tenant.roomId} และย้ายผู้พักทั้งหมดไปยังห้องที่เลือก` : `ระบบจะสิ้นสุดสัญญาและการเข้าพักห้อง ${tenant.roomId} ทันที`}
      onCancel={() => setIsConfirming(false)}
      onConfirm={() => void submit().finally(() => setIsConfirming(false))}
      title={type === "MOVE_ROOM" ? "ยืนยันการย้ายห้องหรือไม่?" : "ยืนยันการย้ายออกหรือไม่?"}
    /> : null}
    {discardDialog}
  </>;
}

// แถวหนึ่งข้อของ checklist พร้อมปุ่มลัดไปหน้าที่ต้องไปทำ ใช้แค่ในไฟล์นี้
function ReadinessRow({ action, help, loading, onAction, ready, title }: Readonly<{ action: string; help: string; loading: boolean; onAction: () => void; ready: boolean; title: string }>) {
  return <div className="flex items-center gap-3 rounded-xl border border-[#d9dae0] bg-white/50 p-3">
    <ReadinessIcon loading={loading} ready={ready} />
    <span className="min-w-0 flex-1"><strong className="block text-sm">{title}</strong><small className="opacity-60">{help}</small></span>
    {!ready && !loading ? <button className="secondary-button" onClick={onAction} type="button">{action} <ArrowRight size={15} /></button> : null}
  </div>;
}

function transitionSubmitLabel(isSubmitting: boolean, type: TransitionType) {
  if (isSubmitting) return "กำลังดำเนินการ...";
  return type === "MOVE_ROOM" ? "ตรวจสอบการย้ายห้อง" : "ตรวจสอบการย้ายออก";
}

// ไอคอนสถานะของแต่ละข้อใน checklist กำลังตรวจ ผ่านแล้ว หรือยังไม่ผ่าน
function ReadinessIcon({ loading, ready }: Readonly<{ loading: boolean; ready: boolean }>) {
  if (loading) return <LoaderCircle aria-label="กำลังตรวจสอบ" className="animate-spin" size={20} />;
  if (ready) return <CheckCircle2 aria-label="ผ่าน" className="text-emerald-600" size={20} />;
  return <XCircle aria-label="ยังไม่ผ่าน" className="text-red-600" size={20} />;
}
