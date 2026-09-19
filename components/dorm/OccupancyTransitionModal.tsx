"use client";
// เก็บค่าที่กรอกในฟอร์มและยิงคำขอจากเบราว์เซอร์

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, CheckCircle2, LoaderCircle, LogOut, Plus, RefreshCw, Trash2, X, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";
import { DropdownField } from "@/components/dorm/DropdownField";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { Dialog } from "@/components/ui/Dialog";
import { currency } from "@/lib/dorm-utils";
import type { Room, Tenant } from "@/types/dorm";
import { ownerPagePath } from "@/lib/navigation-routes";

// เก็บจำนวนเงินเป็นสตริงเพราะมาจากช่องกรอก ค่อยแปลงเป็นตัวเลขตอนคำนวณกับตอนส่ง
type Deduction = { label: string; amount: string };
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
export function OccupancyTransitionModal({ onClose, onCompleted, propertyId, rooms, tenant }: {
  onClose: () => void;
  onCompleted: (leaseDraft?: MoveRoomLeaseDraft) => Promise<void>;
  propertyId: string;
  rooms: Room[];
  tenant: Tenant;
}) {
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
    if (!reason.trim() || (type === "MOVE_ROOM" && !destinationRoomId)) {
      setError(type === "MOVE_ROOM" ? "กรุณาเลือกห้องปลายทางและระบุเหตุผล" : "กรุณาระบุเหตุผล");
      return;
    }
    if (deductions.some((item) => !item.label.trim() || Number(item.amount) < 0 || !Number.isFinite(Number(item.amount)))) {
      setError("กรุณาตรวจสอบรายการหักเงินประกัน");
      return;
    }
    // ย้ายออกต้องครบทั้งสามอย่าง ระบบตรวจสองอย่างแรกให้ ส่วนการตรวจห้องต้องมีคนยืนยัน
    if (type === "MOVE_OUT" && (!readiness?.ready || !roomInspected)) {
      setError("กรุณาทำรายการย้ายออกให้ครบ: มิเตอร์สุดท้าย บิลสุดท้าย และตรวจสภาพห้อง");
      return;
    }
    setError("");
    setIsConfirming(true);
  };

  // ตรวจซ้ำอีกรอบตรงนี้ เพราะ requestConfirmation กับ submit ถูกเรียกคนละจังหวะ
  const submit = async () => {
    if (!reason.trim() || (type === "MOVE_ROOM" && !destinationRoomId)) {
      setError(type === "MOVE_ROOM" ? "กรุณาเลือกห้องปลายทางและระบุเหตุผล" : "กรุณาระบุเหตุผล");
      return;
    }
    if (deductions.some((item) => !item.label.trim() || Number(item.amount) < 0 || !Number.isFinite(Number(item.amount)))) {
      setError("กรุณาตรวจสอบรายการหักเงินประกัน");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tenants/${tenant.id}/transitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ...(type === "MOVE_ROOM" ? { destinationRoomId } : {}),
          effectiveDate,
          reason,
          // แนบผลตรวจไว้ในหมายเหตุ เพื่อให้ประวัติบอกได้ว่าตอนนั้นตรวจอะไรผ่านมาบ้าง
          settlementNote: type === "MOVE_OUT"
            ? `[ตรวจจากระบบ: มิเตอร์และบิลสุดท้ายครบ, ผู้ใช้ยืนยันตรวจสภาพห้อง]${note ? ` ${note}` : ""}`
            : note || undefined,
          deductions: deductions.map((item) => ({ label: item.label, amount: Number(item.amount) })),
        }),
      });
      const payload = await response.json() as {
        data?: { transferredAmount: number };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "ดำเนินการไม่สำเร็จ");
      // ย้ายห้องต้องรู้ยอดที่โอนไป ไม่งั้นสัญญาใหม่จะกรอกเงินประกันไม่ถูก
      if (type === "MOVE_ROOM" && !payload.data) throw new Error("ไม่พบข้อมูลยอดเงินประกันที่โอนไปห้องใหม่");
      const destinationRoom = destinationRooms.find((room) => room.databaseId === destinationRoomId);
      // ส่งร่างสัญญาใหม่กลับไปเฉพาะตอนย้ายห้อง ย้ายออกไม่มีสัญญาต่อ
      await onCompleted(type === "MOVE_ROOM" ? {
        depositAmount: payload.data!.transferredAmount,
        monthlyRent: destinationRoom?.rent ?? tenant.monthlyRent ?? 0,
        roomId: destinationRoomId,
        startDate: effectiveDate,
      } : undefined);
      notify({ message: type === "MOVE_ROOM" ? "ย้ายห้องและโอนยอดเงินประกันแล้ว" : "ย้ายออกและสรุปเงินประกันแล้ว" });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ดำเนินการไม่สำเร็จ");
    } finally { setIsSubmitting(false); }
  };

  return <><Dialog ariaDescribedBy="occupancy-transition-description" ariaLabelledBy="occupancy-transition-title" backdropClassName="z-[80]" className="max-w-3xl" onClose={requestClose}>
      <header className="modal-header"><div><p className="eyebrow" id="occupancy-transition-description">Occupancy workflow</p><h2 id="occupancy-transition-title">{tenant.name} · ห้อง {tenant.roomId}</h2></div><IconButton label="ปิด" onClick={requestClose}><X aria-hidden="true" /></IconButton></header>
      <div className="grid gap-5 p-6">
        <div className="grid grid-cols-2 gap-3">
          <button className={`rounded-2xl border p-4 text-left ${type === "MOVE_OUT" ? "border-brand bg-brand/10" : "border-[#d9dae0]"}`} onClick={() => setType("MOVE_OUT")} type="button"><LogOut className="mb-2" /><strong className="block">ย้ายออก</strong><small>สิ้นสุดสัญญาและสรุปยอดคืนเงินประกัน</small></button>
          <button className={`rounded-2xl border p-4 text-left ${type === "MOVE_ROOM" ? "border-brand bg-brand/10" : "border-[#d9dae0]"}`} onClick={() => setType("MOVE_ROOM")} type="button"><ArrowRightLeft className="mb-2" /><strong className="block">ย้ายห้อง</strong><small>ย้ายผู้พักทั้งห้องและโอนเงินประกันคงเหลือ</small></button>
        </div>
        <div className="tenant-config-grid">
          {/* max เป็นวันนี้ เพราะย้ายออกในอนาคตต้องรอให้ถึงวันจริงก่อน จะได้ไม่ปิดสัญญาล่วงหน้า */}
          <label><span>วันที่มีผล</span><input max={new Date().toISOString().slice(0, 10)} onChange={(event) => setEffectiveDate(event.target.value)} required type="date" value={effectiveDate} /></label>
          {type === "MOVE_ROOM" ? <DropdownField label="ห้องปลายทาง" onChange={setDestinationRoomId} options={[{ label: "เลือกห้องว่าง", value: "" }, ...destinationRooms.flatMap((room) => room.databaseId ? [{ label: `${room.id} · ${currency.format(room.rent)}/เดือน`, value: room.databaseId }] : [])]} value={destinationRoomId} /> : null}
          <label className="full-width"><span>เหตุผล</span><textarea maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder={type === "MOVE_OUT" ? "เช่น ครบกำหนดสัญญา" : "เช่น ต้องการห้องขนาดใหญ่ขึ้น"} required value={reason} /></label>
        </div>
        <section className="rounded-2xl border border-[#d9dae0] p-4">
          <div className="mb-3 flex items-center justify-between"><div><strong>รายการหักเงินประกัน</strong><p className="text-sm opacity-60">ค่าค้างชำระจากบิลจะถูกระบบรวมให้อัตโนมัติ</p></div><button className="secondary-button" onClick={() => setDeductions((current) => [...current, { label: "", amount: "" }])} type="button"><Plus size={16} /> เพิ่มรายการ</button></div>
          {/* ใช้ index เป็น key ได้เพราะแถวเหล่านี้ไม่มี id และผู้ใช้ไม่ได้สลับลำดับ */}
          <div className="grid gap-2">{deductions.map((item, index) => <div className="grid grid-cols-[1fr_160px_44px] gap-2" key={index}><input aria-label={`รายละเอียดรายการหัก ${index + 1}`} maxLength={160} onChange={(event) => setDeductions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} placeholder="เช่น ค่าทำความสะอาด" value={item.label} /><input aria-label={`จำนวนเงินรายการหัก ${index + 1}`} min="0" onChange={(event) => setDeductions((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: event.target.value } : row))} placeholder="บาท" step="0.01" type="number" value={item.amount} /><IconButton label="ลบรายการ" onClick={() => setDeductions((current) => current.filter((_, rowIndex) => rowIndex !== index))} variant="danger"><Trash2 size={16} /></IconButton></div>)}</div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><span className="block opacity-60">เงินประกัน</span><strong>{currency.format(tenant.deposit)}</strong></div><div><span className="block opacity-60">รายการหัก</span><strong>{currency.format(deductionTotal)}</strong></div><div><span className="block opacity-60">คงเหลือเบื้องต้น</span><strong>{currency.format(preliminaryBalance)}</strong></div></div>
        </section>
        {/* สองข้อแรกระบบตรวจให้ ข้อสามต้องมีคนไปดูห้องจริง จึงเป็นช่องติ๊กเอง */}
        {type === "MOVE_OUT" ? <section className="rounded-2xl border border-brand/20 bg-brand/5 p-4">
          <strong>Checklist ก่อนย้ายออก</strong>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm opacity-60">ระบบตรวจข้อมูลของเดือน {readiness?.billingMonth ?? effectiveDate.slice(0, 7)} จากฐานข้อมูล</p><button className="secondary-button" disabled={isCheckingReadiness} onClick={() => void loadReadiness()} type="button"><RefreshCw className={isCheckingReadiness ? "animate-spin" : ""} size={16} /> ตรวจอีกครั้ง</button></div>
          <div className="grid gap-3">
            <ReadinessRow action="เปิดหน้ามิเตอร์" help={readiness?.meters.ready ? "พบมิเตอร์น้ำและไฟของเดือนที่ย้ายออกแล้ว" : "ต้องบันทึกทั้งมิเตอร์น้ำและไฟของเดือนที่ย้ายออก"} loading={isCheckingReadiness} onAction={() => window.open(ownerPagePath(propertyId, readiness?.meters.waterRecordedAt ? "electricMeter" : "waterMeter"), "_blank", "noopener,noreferrer")} ready={Boolean(readiness?.meters.ready)} title="1. มิเตอร์น้ำและไฟครั้งสุดท้าย" />
            <ReadinessRow action="เปิดหน้าบิล" help={readiness?.invoice.ready ? `พบบิล ${readiness.invoice.invoiceNumber}` : "ต้องสร้างและออกบิลสุดท้ายให้พ้นสถานะฉบับร่าง"} loading={isCheckingReadiness} onAction={() => window.open(ownerPagePath(propertyId, "invoices"), "_blank", "noopener,noreferrer")} ready={Boolean(readiness?.invoice.ready)} title="2. บิลสุดท้าย" />
            <label className="flex items-start gap-3 rounded-xl border border-[#d9dae0] bg-white/50 p-3"><input checked={roomInspected} className="mt-1 size-4" onChange={(event) => setRoomInspected(event.target.checked)} type="checkbox" /><span><strong className="block text-sm">3. ตรวจสภาพห้องและรายการหัก</strong><small className="opacity-60">ส่วนนี้ต้องยืนยันด้วยผู้ตรวจห้อง เพิ่มความเสียหายในรายการหักด้านบน</small></span></label>
          </div>
          {readinessError ? <p className="form-alert error mt-3" role="alert">{readinessError}</p> : null}
        </section> : null}
        <label><span>หมายเหตุการชำระ/คืนเงิน</span><textarea maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="เช่น คืนผ่านบัญชีธนาคารภายใน 7 วัน" value={note} /></label>
        {error ? <p className="form-alert error" role="alert">{error}</p> : null}
        <p className="form-alert" role="status">เมื่อยืนยัน ระบบจะปิดสัญญาเดิมและการเข้าพักทันที {type === "MOVE_ROOM" ? "จากนั้นระบบจะเปิดฟอร์มสร้างสัญญาห้องใหม่พร้อมกรอกข้อมูลเดิมให้" : "ระบบจะบันทึกสรุปการย้ายออกและเงินประกันไว้ในประวัติ"}</p>
      </div>
      <footer className="modal-actions"><button className="secondary-button" disabled={isSubmitting} onClick={requestClose} type="button">ยกเลิก</button><button className="primary-button" disabled={isSubmitting} onClick={requestConfirmation} type="button">{isSubmitting ? "กำลังดำเนินการ..." : type === "MOVE_ROOM" ? "ตรวจสอบการย้ายห้อง" : "ตรวจสอบการย้ายออก"}</button></footer>
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
function ReadinessRow({ action, help, loading, onAction, ready, title }: { action: string; help: string; loading: boolean; onAction: () => void; ready: boolean; title: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-[#d9dae0] bg-white/50 p-3">
    {loading ? <LoaderCircle className="animate-spin" aria-label="กำลังตรวจสอบ" size={20} /> : ready ? <CheckCircle2 className="text-emerald-600" aria-label="ผ่าน" size={20} /> : <XCircle className="text-red-600" aria-label="ยังไม่ผ่าน" size={20} />}
    <span className="min-w-0 flex-1"><strong className="block text-sm">{title}</strong><small className="opacity-60">{help}</small></span>
    {!ready && !loading ? <button className="secondary-button" onClick={onAction} type="button">{action} <ArrowRight size={15} /></button> : null}
  </div>;
}
