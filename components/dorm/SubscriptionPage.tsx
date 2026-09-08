"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Subscription Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, CreditCard, LockKeyhole, RefreshCw, Upload } from "lucide-react";
import { LoadMoreButton, RetryButton } from "@/components/ui/DataNavigation";
import { DropdownField } from "@/components/dorm/DropdownField";
import type { OwnerDashboardAggregation } from "@/types/dashboard";
import { formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Plan” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Plan = {
  id: string; code: string; name: string; description: string | null;
  monthlyPrice: string; yearlyPrice: string | null; maxRooms: number;
  maxProperties: number; allowPromptPay: boolean; allowFileUploads: boolean;
};
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Payment” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Payment = {
  id: string; status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  submittedAt: string; rejectionNote: string | null;
};
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Order” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Order = {
  id: string; orderNumber: string; planName: string; type: "NEW" | "RENEWAL";
  status: "PENDING_PAYMENT" | "PENDING_REVIEW" | "PAID" | "REJECTED" | "CANCELLED" | "EXPIRED";
  billingInterval: "MONTHLY" | "YEARLY"; amount: string; expiresAt: string;
  activatedAt: string | null; payments: Payment[];
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “json” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
async function json<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

const maxSlipSize = 5 * 1024 * 1024;
const allowedSlipTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Subscription Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { propertyId, subscription }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SubscriptionPage({ propertyId, subscription }: {
  propertyId: string;
  subscription: OwnerDashboardAggregation["subscription"];
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [planId, setPlanId] = useState("");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [actionError, setActionError] = useState("");
  const [plansError, setPlansError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [message, setMessage] = useState("");
  const [plansLoading, setPlansLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [page, setPage] = useState(1);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Plans” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadPlans = useCallback(async () => {
    setPlansLoading(true); setPlansError("");
    try {
      const availablePlans = await json<Plan[]>(await fetch("/api/v1/plans", { cache: "no-store" }));
      setPlans(availablePlans);
      setPlanId((current) => availablePlans.some((plan) => plan.id === current) ? current : availablePlans[0]?.id ?? "");
    } catch (cause) {
      setPlansError(formatClientError(cause, "โหลดแพ็กเกจไม่สำเร็จ"));
    } finally { setPlansLoading(false); }
  }, []);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Orders” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadOrders = useCallback(async (targetPage = 1, append = false) => {
    setOrdersLoading(true); setOrdersError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/subscription-orders?page=${targetPage}&pageSize=20`, { cache: "no-store" });
      const payload = await readApiPayload<{ data?: Order[]; pageInfo?: { page: number; hasNextPage: boolean }; error?: string; requestId?: string }>(response, "โหลดคำสั่งซื้อไม่สำเร็จ");
      if (!payload.data || !payload.pageInfo) throw new Error("ข้อมูลคำสั่งซื้อที่ได้รับไม่ครบถ้วน");
      setOrders((current) => append ? [...current, ...payload.data!] : payload.data!);
      setPage(payload.pageInfo!.page);
      setHasNextPage(payload.pageInfo!.hasNextPage);
    } catch (cause) {
      setOrdersError(formatClientError(cause, "โหลดคำสั่งซื้อไม่สำเร็จ"));
    } finally { setOrdersLoading(false); }
  }, [propertyId]);

  useEffect(() => { void loadPlans(); void loadOrders(); }, [loadOrders, loadPlans]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Order” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function createOrder(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true); setActionError(""); setMessage("");
    try {
      await json(await fetch(`/api/v1/admin/properties/${propertyId}/subscription-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingInterval }),
      }));
      setMessage("สร้างคำสั่งซื้อแล้ว ขั้นตอนถัดไปคืออัปโหลดหลักฐานการชำระในรายการด้านล่างภายใน 48 ชั่วโมง");
      await loadOrders();
    } catch (cause) { setActionError(formatClientError(cause, "สร้างคำสั่งซื้อไม่สำเร็จ")); }
    finally { setSubmitting(false); }
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “upload” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - orderId: รหัสภายในของ order
   * - file: ค่า “file” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function upload(orderId: string, file: File | null) {
    if (!file) return;
    if (!allowedSlipTypes.has(file.type)) {
      setActionError("รองรับหลักฐานเฉพาะไฟล์ PNG, JPG และ PDF");
      return;
    }
    if (file.size < 1 || file.size > maxSlipSize) {
      setActionError("ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    setSubmitting(true); setActionError(""); setMessage("");
    try {
      const body = new FormData(); body.set("file", file);
      await json(await fetch(`/api/v1/admin/properties/${propertyId}/subscription-orders/${orderId}/payments`, {
        method: "POST", body,
      }));
      setMessage("ส่งหลักฐานเรียบร้อยแล้ว Super Admin จะตรวจสอบรายการ เมื่ออนุมัติระบบจะเปิดใช้หรือต่ออายุแพ็กเกจให้อัตโนมัติ");
      await loadOrders();
    } catch (cause) { setActionError(formatClientError(cause, "ส่งหลักฐานไม่สำเร็จ")); }
    finally { setSubmitting(false); }
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “selected” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - plan: ค่า “plan” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const selected = plans.find((plan) => plan.id === planId);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Order” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - order: ค่า “order” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const openOrder = orders.find((order) => ["PENDING_PAYMENT", "PENDING_REVIEW"].includes(order.status));
  const createDisabledReason = openOrder
    ? openOrder.status === "PENDING_PAYMENT"
      ? `คำสั่งซื้อ ${openOrder.orderNumber} รออัปโหลดหลักฐาน จึงยังสร้างรายการใหม่ไม่ได้`
      : `คำสั่งซื้อ ${openOrder.orderNumber} อยู่ระหว่างตรวจสอบ จึงยังสร้างรายการใหม่ไม่ได้`
    : "";
  return <div className="settings-section-stack grid gap-6">
    {actionError ? <p className="form-alert error" role="alert">{actionError}</p> : null}
    {message ? <p className="form-alert" role="status">{message}</p> : null}
    <section className="panel settings-section">
      <div className="settings-section-head"><div><h2>แพ็กเกจปัจจุบัน</h2><p>สถานะการใช้งานของหอพักนี้</p></div></div>
      {subscription ? <>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-brand/[.06] p-4"><small className="text-[#73757d]">แพ็กเกจ</small><strong className="mt-1 block text-lg">{subscription.planName}</strong><span className="badge mt-2">{subscription.accessMode === "FULL" ? "ใช้งานได้" : subscription.accessMode === "GRACE" ? "ช่วงผ่อนผัน" : "อ่านอย่างเดียว"}</span></div>
          <div className="rounded-2xl border border-[#e3e4e8] p-4"><small className="text-[#73757d]">วันหมดอายุ</small><strong className="mt-1 block text-lg">{new Date(subscription.expiresAt).toLocaleDateString("th-TH")}</strong><p className="mt-1 text-sm text-[#73757d]">{subscription.accessMode === "GRACE" && subscription.graceEndsAt ? `แก้ไขข้อมูลได้ถึง ${new Date(subscription.graceEndsAt).toLocaleDateString("th-TH")}` : `${subscription.usedRooms}/${subscription.maxRooms} ห้องที่ใช้งาน`}</p></div>
          <div className="rounded-2xl border border-[#e3e4e8] p-4"><small className="text-[#73757d]">การต่ออายุ</small><strong className="mt-1 block">ระยะเวลาใหม่ต่อจากสิทธิ์เดิม</strong><p className="mt-1 text-sm text-[#73757d]">หากสิทธิ์เดิมหมดแล้ว ระยะเวลาใหม่จะเริ่มเมื่อการชำระได้รับอนุมัติ</p></div>
        </div>
        <div className="mt-5" aria-label="ลำดับเวลาสถานะแพ็กเกจ">
          <h3 className="font-black">ลำดับเวลาการใช้งาน</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <TimelineStep active icon={<CheckCircle2 size={18} />} label="เริ่มใช้งาน" value={new Date(subscription.startsAt).toLocaleDateString("th-TH")} />
            <TimelineStep active={new Date(subscription.expiresAt) <= new Date()} icon={<CalendarDays size={18} />} label="แพ็กเกจหมดอายุ" value={new Date(subscription.expiresAt).toLocaleDateString("th-TH")} />
            <TimelineStep active={subscription.accessMode === "READ_ONLY"} icon={<LockKeyhole size={18} />} label="เปลี่ยนเป็นอ่านอย่างเดียว" value={subscription.graceEndsAt ? new Date(subscription.graceEndsAt).toLocaleDateString("th-TH") : "เมื่อสิทธิ์ใช้งานสิ้นสุด"} />
          </div>
          {subscription.accessMode === "GRACE" ? <p className="form-alert mt-3">ขณะนี้ยังแก้ไขข้อมูลได้ถึง {subscription.graceEndsAt ? new Date(subscription.graceEndsAt).toLocaleDateString("th-TH") : "-"} หลังจากนั้นระบบจะเปลี่ยนเป็นโหมดอ่านอย่างเดียว</p> : subscription.accessMode === "READ_ONLY" ? <p className="form-alert mt-3">ข้อมูลเดิมยังเปิดดูได้ เมื่อการต่ออายุได้รับอนุมัติ ระบบจะกลับมาใช้งานเต็มรูปแบบโดยอัตโนมัติ</p> : null}
        </div>
      </> : <div className="rounded-2xl bg-amber-50 p-4 text-amber-800"><strong>ยังไม่มีแพ็กเกจที่ใช้งานอยู่</strong><p className="mt-1 text-sm">เลือกแพ็กเกจด้านล่างเพื่อเริ่มเปิดใช้งานหอพัก</p></div>}
    </section>
    <section className="panel settings-section">
      <div className="settings-section-head"><div><h2>ซื้อหรือต่ออายุแพ็กเกจ</h2><p>ราคาและสิทธิ์จะถูกบันทึกไว้ในคำสั่งซื้อ</p></div></div>
      {plansError ? <div className="form-alert error" role="alert"><span>{plansError}</span><RetryButton label="ลองโหลดแพ็กเกจใหม่" onClick={() => void loadPlans()} /></div> : null}
      {plansLoading ? <p aria-atomic="true" className="py-6 text-center" role="status">กำลังโหลดแพ็กเกจ...</p> : plans.length === 0 && !plansError ? <div className="rounded-2xl bg-amber-50 p-4 text-amber-800"><strong>ยังไม่มีแพ็กเกจเปิดขายในขณะนี้</strong><p className="mt-1 text-sm">กรุณาติดต่อแอดมินใหญ่หรือกลับมาลองใหม่ภายหลัง</p></div> : <form className="grid gap-4 lg:grid-cols-[1fr_220px_auto]" onSubmit={createOrder}>
        <DropdownField label="แพ็กเกจ" onChange={setPlanId} options={plans.map((plan) => ({ label: `${plan.name} · สูงสุด ${plan.maxRooms} ห้อง`, value: plan.id }))} value={planId} />
        <DropdownField label="รอบบิล" onChange={(value) => setBillingInterval(value as "MONTHLY" | "YEARLY")} options={[{ label: "รายเดือน", value: "MONTHLY" }, { label: "รายปี", value: "YEARLY" }]} value={billingInterval} />
        <button aria-describedby={createDisabledReason ? "subscription-order-disabled-reason" : undefined} className="primary-button self-end" disabled={submitting || !planId || Boolean(openOrder)} type="submit">{subscription || orders.some((order) => order.status === "PAID") ? <RefreshCw size={18} /> : <CreditCard size={18} />}{submitting ? "กำลังดำเนินการ..." : subscription || orders.some((order) => order.status === "PAID") ? "ต่ออายุ" : "สร้างคำสั่งซื้อ"}</button>
      </form>}
      {selected ? <div className="mt-4 rounded-2xl bg-brand/[.06] p-4"><strong className="text-xl">{billingInterval === "YEARLY" ? Number(selected.yearlyPrice ?? Number(selected.monthlyPrice) * 12).toLocaleString("th-TH") : Number(selected.monthlyPrice).toLocaleString("th-TH")} บาท/{billingInterval === "YEARLY" ? "ปี" : "เดือน"}</strong><p className="mt-1 text-sm text-[#73757d]">{selected.description || `รองรับ ${selected.maxProperties} หอ และ ${selected.maxRooms} ห้อง`}</p></div> : null}
      {createDisabledReason ? <p className="mt-4 text-sm font-bold text-amber-700" id="subscription-order-disabled-reason">{createDisabledReason}</p> : null}
    </section>

    <section className="panel settings-section">
      <div className="settings-section-head"><div><h2>ประวัติคำสั่งซื้อ</h2><p>ตรวจสอบสถานะการสมัคร การชำระเงิน และการต่ออายุย้อนหลัง</p></div></div>
      {ordersError ? <div className="form-alert error mt-4" role="alert"><span>{ordersError}</span><RetryButton label="ลองโหลดประวัติใหม่" onClick={() => void loadOrders()} /></div> : null}
      {ordersLoading && !orders.length ? <p aria-atomic="true" className="py-8 text-center" role="status">กำลังโหลดประวัติ...</p> : orders.length ? <div className="mt-4 grid gap-3">{orders.map((order) => {
        const latestPayment = order.payments[0];
        return <article className={`rounded-2xl border p-4 ${openOrder?.id === order.id ? "border-amber-300 bg-amber-50/50" : "border-[#e3e4e8]"}`} data-testid="subscription-order" key={order.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{order.orderNumber}</strong><p className="text-sm text-[#73757d]">{order.planName} · {order.type === "RENEWAL" ? "ต่ออายุ" : "สมัครใหม่"} · {order.billingInterval === "YEARLY" ? "รายปี" : "รายเดือน"}</p>{["PENDING_PAYMENT", "PENDING_REVIEW"].includes(order.status) ? <p className="mt-1 text-xs font-bold text-amber-800">รายการนี้กำลังดำเนินการและป้องกันการสร้างคำสั่งซื้อซ้ำ</p> : null}</div><div className="text-right"><strong className="block text-xl">{Number(order.amount).toLocaleString("th-TH")} บาท</strong><OrderStatus value={order.status} /></div></div>
          {latestPayment?.rejectionNote ? <p className="form-alert error mt-3">ปฏิเสธ: {latestPayment.rejectionNote}</p> : null}
          {order.status === "PENDING_PAYMENT" ? <div className="mt-4"><label className="secondary-button inline-flex cursor-pointer"><Upload size={17} /> ส่งสลิป<input accept="image/png,image/jpeg,application/pdf" className="sr-only" disabled={submitting} onChange={(event) => { const file = event.target.files?.[0] ?? null; event.target.value = ""; void upload(order.id, file); }} type="file" /></label><p className="mt-2 flex items-center gap-1 text-xs text-[#73757d]"><AlertCircle size={13} /> PNG, JPG หรือ PDF ขนาดไม่เกิน 5 MB · คำสั่งซื้อหมดอายุ {new Date(order.expiresAt).toLocaleString("th-TH")}</p></div> : null}
          {order.status === "PENDING_REVIEW" ? <p className="mt-3 flex items-center gap-2 text-sm text-amber-700"><Clock3 size={16} /> ส่งหลักฐานแล้ว รอ Super Admin ตรวจสอบ ไม่ต้องส่งซ้ำ</p> : null}
          {order.status === "PAID" ? <p className="mt-3 flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={16} /> เปิดใช้งานแล้ว {order.activatedAt ? new Date(order.activatedAt).toLocaleString("th-TH") : ""}</p> : null}
        </article>;
      })}</div> : !ordersError ? <div className="py-8 text-center text-[#73757d]"><CreditCard className="mx-auto mb-2 opacity-40" /><strong className="block text-[#292a30]">ยังไม่มีคำสั่งซื้อ</strong><p className="mt-1 text-sm">เลือกแพ็กเกจด้านบนเพื่อเริ่มสมัครหรือต่ออายุ</p></div> : null}
      {hasNextPage ? <LoadMoreButton isLoading={ordersLoading} onClick={() => void loadOrders(page + 1, true)} /> : null}
    </section>
  </div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Timeline Step” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { active, icon, label, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function TimelineStep({ active, icon, label, value }: { active: boolean; icon: React.ReactNode; label: string; value: string }) {
  return <div className={`rounded-2xl border p-4 ${active ? "border-brand/30 bg-brand/[.05]" : "border-[#e3e4e8]"}`}><div className="flex items-center gap-2"><span className={active ? "text-brand" : "text-[#9a9ca5]"}>{icon}</span><strong>{label}</strong></div><p className="mt-2 text-sm text-[#73757d]">{value}</p></div>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Order Status” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function OrderStatus({ value }: { value: Order["status"] }) {
  const labels: Record<Order["status"], string> = {
    PENDING_PAYMENT: "รอชำระ", PENDING_REVIEW: "รอตรวจสอบ", PAID: "เปิดใช้งานแล้ว",
    REJECTED: "ไม่ผ่าน", CANCELLED: "ยกเลิก", EXPIRED: "หมดอายุ",
  };
  return <span className={`badge ${value === "PAID" ? "badge-paid" : ""}`}>{labels[value]}</span>;
}
