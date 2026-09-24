"use client";
// โหลดข้อมูลและอัปโหลดไฟล์จากเบราว์เซอร์

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, CreditCard, LockKeyhole, RefreshCw, Upload } from "lucide-react";
import { LoadMoreButton, RetryButton } from "@/components/ui/DataNavigation";
import type { OwnerDashboardAggregation } from "@/types/dashboard";
import { formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";

// ราคาเป็นสตริงเพราะฝั่งเซิร์ฟเวอร์ใช้ Decimal ส่งเป็น number ตรง ๆ จะปัดเศษเพี้ยน
type Plan = {
  id: string; code: string; name: string; description: string | null;
  monthlyPrice: string; yearlyPrice: string | null; maxRooms: number;
  maxProperties: number; allowPromptPay: boolean; allowFileUploads: boolean;
};
// หลักฐานการโอนหนึ่งครั้ง ถูกปฏิเสธก็ส่งใหม่ได้ จึงมีได้หลายรายการต่อหนึ่งคำสั่งซื้อ
type Payment = {
  id: string; status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  submittedAt: string; rejectionNote: string | null;
};
// คำสั่งซื้อหนึ่งรายการ NEW คือสมัครใหม่ RENEWAL คือต่ออายุของเดิม
type Order = {
  id: string; orderNumber: string; planName: string; type: "NEW" | "RENEWAL";
  status: "PENDING_PAYMENT" | "PENDING_REVIEW" | "PAID" | "REJECTED" | "CANCELLED" | "EXPIRED";
  billingInterval: "MONTHLY" | "YEARLY"; amount: string; expiresAt: string;
  activatedAt: string | null; payments: Payment[];
};

// ห่อ readApiData ไว้ให้ข้อความผิดพลาดของทั้งไฟล์นี้เหมือนกันหมด
async function json<T>(response: Response): Promise<T> {
  return readApiData<T>(response, "ดำเนินการไม่สำเร็จ");
}

// ตรวจไฟล์ตรงนี้เพื่อบอกผู้ใช้เร็ว ๆ ส่วนการตรวจที่เชื่อถือได้ยังอยู่ที่เซิร์ฟเวอร์
// ใช้วิธีระบุชนิดที่อนุญาต ไม่ใช่ระบุชนิดที่ห้าม จะได้ไม่มีช่องโหว่จากชนิดที่นึกไม่ถึง
const maxSlipSize = 5 * 1024 * 1024;
const allowedSlipTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);

// หน้าแพ็กเกจฝั่งเจ้าของหอ ดูสิทธิ์ปัจจุบัน ซื้อหรือต่ออายุ และส่งหลักฐานการโอน
// initialData ส่งมาจาก Server Component ของหน้านี้ แพ็กเกจกับคำสั่งซื้อจึงมาพร้อม HTML
export function SubscriptionPage({ initialData = null, propertyId, subscription }: Readonly<{
  initialData?: { orders: Order[]; ordersHasNextPage: boolean; plans: Plan[] } | null;
  propertyId: string;
  subscription: OwnerDashboardAggregation["subscription"];
}>) {
  const [plans, setPlans] = useState<Plan[]>(initialData?.plans ?? []);
  const [orders, setOrders] = useState<Order[]>(initialData?.orders ?? []);
  const skipInitialLoadRef = useRef(initialData !== null);
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [actionError, setActionError] = useState("");
  const [plansError, setPlansError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [message, setMessage] = useState("");
  const [plansLoading, setPlansLoading] = useState(initialData === null);
  const [ordersLoading, setOrdersLoading] = useState(initialData === null);
  const [submitting, setSubmitting] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(initialData?.ordersHasNextPage ?? false);
  const [page, setPage] = useState(1);

  // แยกสถานะโหลดกับข้อผิดพลาดของแพ็กเกจและประวัติออกจากกัน ฝั่งหนึ่งพังอีกฝั่งจะได้ยังใช้ได้
  const loadPlans = useCallback(async () => {
    setPlansLoading(true); setPlansError("");
    try {
      const availablePlans = await json<Plan[]>(await fetch("/api/v1/plans", { cache: "no-store" }));
      setPlans(availablePlans);
    } catch (cause) {
      setPlansError(formatClientError(cause, "โหลดแพ็กเกจไม่สำเร็จ"));
    } finally { setPlansLoading(false); }
  }, []);

  const loadOrders = useCallback(async (targetPage = 1, append = false) => {
    setOrdersLoading(true); setOrdersError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/subscription-orders?page=${targetPage}&pageSize=20`, { cache: "no-store" });
      const payload = await readApiPayload<{ data?: Order[]; pageInfo?: { page: number; hasNextPage: boolean }; error?: string; requestId?: string }>(response, "โหลดคำสั่งซื้อไม่สำเร็จ");
      // ตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้ ต้องดักไว้ก่อน
      if (!payload.data || !payload.pageInfo) throw new Error("ข้อมูลคำสั่งซื้อที่ได้รับไม่ครบถ้วน");
      setOrders((current) => append ? [...current, ...payload.data!] : payload.data!);
      setPage(payload.pageInfo!.page);
      setHasNextPage(payload.pageInfo!.hasNextPage);
    } catch (cause) {
      setOrdersError(formatClientError(cause, "โหลดคำสั่งซื้อไม่สำเร็จ"));
    } finally { setOrdersLoading(false); }
  }, [propertyId]);

  // ยิงสองคำขอพร้อมกันตอนเปิดหน้า ไม่ต้องรอผลของกันและกัน
  useEffect(() => {
    // เซิร์ฟเวอร์ส่งมาให้แล้ว รอบแรกจึงข้ามไป
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    void loadPlans();
    void loadOrders();
  }, [loadOrders, loadPlans]);

  // สร้างคำสั่งซื้อ แล้วผู้ใช้ค่อยไปอัปโหลดสลิปในรายการข้างล่าง
  async function submitOrder(targetPlanId: string) {
    setSubmitting(true); setActionError(""); setMessage("");
    try {
      await json(await fetch(`/api/v1/admin/properties/${propertyId}/subscription-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: targetPlanId, billingInterval }),
      }));
      setMessage("สร้างคำสั่งซื้อแล้ว ขั้นตอนถัดไปคืออัปโหลดหลักฐานการชำระในรายการด้านล่างภายใน 48 ชั่วโมง");
      await loadOrders();
    } catch (cause) { setActionError(formatClientError(cause, "สร้างคำสั่งซื้อไม่สำเร็จ")); }
    finally { setSubmitting(false); }
  }

  // ส่งหลักฐานการโอน ตรวจชนิดกับขนาดก่อนเพื่อไม่ให้เสียเวลาอัปโหลดแล้วโดนปฏิเสธ
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
      // FormData เพราะเป็นไฟล์ ไม่ใช่ JSON และปล่อยให้เบราว์เซอร์ตั้ง Content-Type เอง
      const body = new FormData(); body.set("file", file);
      await json(await fetch(`/api/v1/admin/properties/${propertyId}/subscription-orders/${orderId}/payments`, {
        method: "POST", body,
      }));
      setMessage("ส่งหลักฐานเรียบร้อยแล้ว Super Admin จะตรวจสอบรายการ เมื่ออนุมัติระบบจะเปิดใช้หรือต่ออายุแพ็กเกจให้อัตโนมัติ");
      await loadOrders();
    } catch (cause) { setActionError(formatClientError(cause, "ส่งหลักฐานไม่สำเร็จ")); }
    finally { setSubmitting(false); }
  }

  // มีคำสั่งซื้อค้างอยู่ก็ห้ามสร้างใหม่ กันสั่งซ้อนแล้วจ่ายซ้ำ
  const openOrder = orders.find((order) => ["PENDING_PAYMENT", "PENDING_REVIEW"].includes(order.status));
  // ปุ่มที่กดไม่ได้ต้องบอกเหตุผลด้วย และสองสถานะนี้ผู้ใช้ต้องทำคนละอย่าง
  const createDisabledReason = blockingOrderReason(openOrder);
  return <div className="settings-section-stack grid gap-6">
    {actionError ? <p className="form-alert error" role="alert">{actionError}</p> : null}
    {message ? <output className="form-alert block">{message}</output> : null}
    <section className="panel settings-section">
      <div className="settings-section-head"><div><h2>แพ็กเกจปัจจุบัน</h2><p>สถานะการใช้งานของหอพักนี้</p></div></div>
      <CurrentPlanSummary subscription={subscription} />
    </section>
    <section className="panel settings-section">
      <div className="settings-section-head">
        <div><h2>ซื้อหรือต่ออายุแพ็กเกจ</h2><p>ราคาและสิทธิ์จะถูกบันทึกไว้ในคำสั่งซื้อ</p></div>
        <div aria-label="รอบบิล" className="figma-inline-tabs" role="group">
          <button className={billingInterval === "MONTHLY" ? "active" : ""} onClick={() => setBillingInterval("MONTHLY")} type="button">รายเดือน</button>
          <button className={billingInterval === "YEARLY" ? "active" : ""} onClick={() => setBillingInterval("YEARLY")} type="button">รายปี</button>
        </div>
      </div>
      {plansError ? <div className="form-alert error" role="alert"><span>{plansError}</span><RetryButton label="ลองโหลดแพ็กเกจใหม่" onClick={() => void loadPlans()} /></div> : null}
      <PlanGrid billingInterval={billingInterval} createDisabledReason={createDisabledReason} hasError={Boolean(plansError)} isLoading={plansLoading} onSelect={submitOrder} plans={plans} subscriptionPlanName={subscription?.planName} submitting={submitting} />
      {createDisabledReason ? <p className="mt-4 text-sm font-bold text-amber-700" id="subscription-order-disabled-reason">{createDisabledReason}</p> : null}
    </section>

    <section className="panel settings-section">
      <div className="settings-section-head"><div><h2>ประวัติคำสั่งซื้อ</h2><p>ตรวจสอบสถานะการสมัคร การชำระเงิน และการต่ออายุย้อนหลัง</p></div></div>
      {ordersError ? <div className="form-alert error mt-4" role="alert"><span>{ordersError}</span><RetryButton label="ลองโหลดประวัติใหม่" onClick={() => void loadOrders()} /></div> : null}
      <OrderHistoryList hasError={Boolean(ordersError)} isLoading={ordersLoading} onUpload={upload} openOrderId={openOrder?.id ?? null} orders={orders} submitting={submitting} />
      {hasNextPage ? <LoadMoreButton isLoading={ordersLoading} onClick={() => void loadOrders(page + 1, true)} /> : null}
    </section>
  </div>;
}

// มีคำสั่งซื้อค้างอยู่ก็ห้ามสร้างใหม่ กันสั่งซ้อนแล้วจ่ายซ้ำ
// สองสถานะนี้ผู้ใช้ต้องไปทำคนละอย่าง จึงต้องบอกคนละข้อความ
function blockingOrderReason(openOrder: Order | undefined) {
  if (!openOrder) return "";
  if (openOrder.status === "PENDING_PAYMENT") return `คำสั่งซื้อ ${openOrder.orderNumber} รออัปโหลดหลักฐาน จึงยังสร้างรายการใหม่ไม่ได้`;
  return `คำสั่งซื้อ ${openOrder.orderNumber} อยู่ระหว่างตรวจสอบ จึงยังสร้างรายการใหม่ไม่ได้`;
}

type Subscription = OwnerDashboardAggregation["subscription"];

// สิทธิ์การใช้งานสามระดับ ใช้ได้เต็ม ช่วงผ่อนผัน และอ่านอย่างเดียว
function accessModeLabel(accessMode: NonNullable<Subscription>["accessMode"]) {
  if (accessMode === "FULL") return "ใช้งานได้";
  if (accessMode === "GRACE") return "ช่วงผ่อนผัน";
  return "อ่านอย่างเดียว";
}

// วันที่แบบไทย คืนขีดกลางเมื่อไม่มีวันที่
function thaiDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("th-TH") : "-";
}

// ข้อความใต้เส้นเวลา บอกว่าตอนนี้อยู่ขั้นไหนและจะเกิดอะไรต่อ
function TimelineNote({ subscription }: Readonly<{ subscription: NonNullable<Subscription> }>) {
  if (subscription.accessMode === "GRACE") {
    return <p className="form-alert mt-3">ขณะนี้ยังแก้ไขข้อมูลได้ถึง {thaiDate(subscription.graceEndsAt)} หลังจากนั้นระบบจะเปลี่ยนเป็นโหมดอ่านอย่างเดียว</p>;
  }
  if (subscription.accessMode === "READ_ONLY") {
    return <p className="form-alert mt-3">ข้อมูลเดิมยังเปิดดูได้ เมื่อการต่ออายุได้รับอนุมัติ ระบบจะกลับมาใช้งานเต็มรูปแบบโดยอัตโนมัติ</p>;
  }
  return null;
}

// สรุปแพ็กเกจที่ใช้อยู่ พร้อมเส้นเวลาให้เห็นว่าหมดอายุแล้วจะเกิดอะไรต่อ
function CurrentPlanSummary({ subscription }: Readonly<{ subscription: Subscription }>) {
  if (!subscription) {
    return <div className="rounded-2xl bg-amber-50 p-4 text-amber-800">
      <strong>ยังไม่มีแพ็กเกจที่ใช้งานอยู่</strong>
      <p className="mt-1 text-sm">เลือกแพ็กเกจด้านล่างเพื่อเริ่มเปิดใช้งานหอพัก</p>
    </div>;
  }
  return <>
    <div className="plan-current">
      <small>แพ็กเกจ</small>
      <strong>{subscription.planName}</strong>
      <span className="badge">{accessModeLabel(subscription.accessMode)}</span>
      <dl className="plan-current-facts">
        <div><dt>หมดอายุ</dt><dd>{thaiDate(subscription.expiresAt)}</dd></div>
        <div><dt>ห้องที่ใช้งาน</dt><dd>{subscription.usedRooms}/{subscription.maxRooms} ห้อง</dd></div>
        {subscription.accessMode === "GRACE" && subscription.graceEndsAt
          ? <div><dt>แก้ไขข้อมูลได้ถึง</dt><dd>{thaiDate(subscription.graceEndsAt)}</dd></div>
          : null}
      </dl>
    </div>
    <p className="plan-current-note">ต่ออายุแล้วระยะเวลาใหม่จะต่อจากสิทธิ์เดิม หากสิทธิ์เดิมหมดไปแล้ว ระยะเวลาใหม่จะเริ่มนับเมื่อการชำระได้รับอนุมัติ</p>
    {/* ไล่ให้เห็นว่าหมดอายุแล้วจะเกิดอะไรต่อ ผู้ใช้จะได้รู้ว่ายังมีเวลาผ่อนผันอยู่ */}
    <div aria-label="ลำดับเวลาสถานะแพ็กเกจ" className="mt-5">
      <h3 className="text-sm font-semibold text-[#292a30]">ลำดับเวลาการใช้งาน</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <TimelineStep active icon={<CheckCircle2 size={18} />} label="เริ่มใช้งาน" value={thaiDate(subscription.startsAt)} />
        <TimelineStep active={new Date(subscription.expiresAt) <= new Date()} icon={<CalendarDays size={18} />} label="แพ็กเกจหมดอายุ" value={thaiDate(subscription.expiresAt)} />
        <TimelineStep active={subscription.accessMode === "READ_ONLY"} icon={<LockKeyhole size={18} />} label="เปลี่ยนเป็นอ่านอย่างเดียว" value={subscription.graceEndsAt ? thaiDate(subscription.graceEndsAt) : "เมื่อสิทธิ์ใช้งานสิ้นสุด"} />
      </div>
      <TimelineNote subscription={subscription} />
    </div>
  </>;
}

// รายการแพ็กเกจที่เปิดขาย ราคาเปลี่ยนตามรอบบิลที่เลือกไว้ด้านบน
function PlanGrid({ billingInterval, createDisabledReason, hasError, isLoading, onSelect, plans, subscriptionPlanName, submitting }: Readonly<{
  billingInterval: "MONTHLY" | "YEARLY";
  createDisabledReason: string;
  hasError: boolean;
  isLoading: boolean;
  onSelect: (planId: string) => Promise<void>;
  plans: Plan[];
  subscriptionPlanName: string | undefined;
  submitting: boolean;
}>) {
  if (isLoading) return <output aria-atomic="true" className="block py-6 text-center">กำลังโหลดแพ็กเกจ...</output>;
  if (plans.length === 0) {
    if (hasError) return null;
    return <div className="rounded-2xl bg-amber-50 p-4 text-amber-800">
      <strong>ยังไม่มีแพ็กเกจเปิดขายในขณะนี้</strong>
      <p className="mt-1 text-sm">กรุณาติดต่อแอดมินใหญ่หรือกลับมาลองใหม่ภายหลัง</p>
    </div>;
  }
  return <div className="plan-grid">
    {plans.map((plan) => <PlanCard
      billingInterval={billingInterval}
      createDisabledReason={createDisabledReason}
      isCurrent={subscriptionPlanName === plan.name}
      key={plan.id}
      onSelect={onSelect}
      plan={plan}
      submitting={submitting}
    />)}
  </div>;
}

function PlanCard({ billingInterval, createDisabledReason, isCurrent, onSelect, plan, submitting }: Readonly<{
  billingInterval: "MONTHLY" | "YEARLY";
  createDisabledReason: string;
  isCurrent: boolean;
  onSelect: (planId: string) => Promise<void>;
  plan: Plan;
  submitting: boolean;
}>) {
  const yearly = billingInterval === "YEARLY";
  // ไม่ได้ตั้งราคารายปีไว้ก็คิดจากรายเดือนคูณ 12 ให้เอง
  const price = yearly ? Number(plan.yearlyPrice ?? Number(plan.monthlyPrice) * 12) : Number(plan.monthlyPrice);

  return <article className={isCurrent ? "plan-column current" : "plan-column"}>
    <strong className="plan-name">{plan.name}{isCurrent ? <em className="plan-tag">ใช้อยู่</em> : null}</strong>
    <span className="plan-price">{price.toLocaleString("th-TH")}<small> บาท</small></span>
    <small className="plan-period">ต่อ{yearly ? "ปี" : "เดือน"} · เรียกเก็บ{yearly ? "รายปี" : "รายเดือน"}</small>
    <button
      aria-describedby={createDisabledReason ? "subscription-order-disabled-reason" : undefined}
      className={isCurrent ? "secondary-button plan-action" : "primary-button plan-action"}
      // ปิดทุกปุ่มเมื่อมีคำสั่งซื้อค้าง ไม่ใช่แค่ปุ่มของแพ็กเกจนั้น
      disabled={submitting || createDisabledReason !== ""}
      onClick={() => void onSelect(plan.id)}
      type="button"
    >
      {isCurrent ? <RefreshCw size={16} /> : <CreditCard size={16} />}
      {planActionLabel(isCurrent, submitting)}
    </button>
    <p className="plan-caption">{plan.description || `เหมาะกับหอขนาด ${plan.maxRooms} ห้อง`}</p>
    <ul className="plan-features">
      <li><CheckCircle2 aria-hidden={true} size={16} /> สูงสุด {plan.maxRooms.toLocaleString("th-TH")} ห้อง</li>
      <li><CheckCircle2 aria-hidden={true} size={16} /> จัดการได้ {plan.maxProperties.toLocaleString("th-TH")} หอพัก</li>
      {plan.allowPromptPay ? <li><CheckCircle2 aria-hidden={true} size={16} /> รับชำระผ่าน PromptPay</li> : null}
      {plan.allowFileUploads ? <li><CheckCircle2 aria-hidden={true} size={16} /> แนบไฟล์เอกสารและหลักฐาน</li> : null}
    </ul>
  </article>;
}

function planActionLabel(isCurrent: boolean, submitting: boolean) {
  if (submitting) return "กำลังดำเนินการ...";
  return isCurrent ? "ต่ออายุแพ็กเกจนี้" : "เลือกแพ็กเกจนี้";
}

// ประวัติคำสั่งซื้อย้อนหลัง รายการที่ยังค้างอยู่จะถูกไฮไลต์ไว้
function OrderHistoryList({ hasError, isLoading, onUpload, openOrderId, orders, submitting }: Readonly<{
  hasError: boolean;
  isLoading: boolean;
  onUpload: (orderId: string, file: File | null) => Promise<void>;
  openOrderId: string | null;
  orders: Order[];
  submitting: boolean;
}>) {
  if (isLoading && !orders.length) return <output aria-atomic="true" className="block py-8 text-center">กำลังโหลดประวัติ...</output>;
  if (orders.length === 0) {
    if (hasError) return null;
    return <div className="py-8 text-center text-[#73757d]">
      <CreditCard className="mx-auto mb-2 opacity-40" />
      <strong className="block text-[#292a30]">ยังไม่มีคำสั่งซื้อ</strong>
      <p className="mt-1 text-sm">เลือกแพ็กเกจด้านบนเพื่อเริ่มสมัครหรือต่ออายุ</p>
    </div>;
  }
  return <div className="mt-4 grid gap-3">
    {orders.map((order) => <OrderCard isOpenOrder={openOrderId === order.id} key={order.id} onUpload={onUpload} order={order} submitting={submitting} />)}
  </div>;
}

function OrderCard({ isOpenOrder, onUpload, order, submitting }: Readonly<{
  isOpenOrder: boolean;
  onUpload: (orderId: string, file: File | null) => Promise<void>;
  order: Order;
  submitting: boolean;
}>) {
  // API เรียงใหม่สุดมาก่อน เอาเหตุผลที่ถูกปฏิเสธล่าสุดมาแสดง
  const latestPayment = order.payments[0];
  const isPending = ["PENDING_PAYMENT", "PENDING_REVIEW"].includes(order.status);

  return <article className={`rounded-2xl border p-4 ${isOpenOrder ? "border-amber-300 bg-amber-50/50" : "border-[#e3e4e8]"}`} data-testid="subscription-order">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <strong>{order.orderNumber}</strong>
        <p className="text-sm text-[#73757d]">{order.planName} · {order.type === "RENEWAL" ? "ต่ออายุ" : "สมัครใหม่"} · {order.billingInterval === "YEARLY" ? "รายปี" : "รายเดือน"}</p>
        {isPending ? <p className="mt-1 text-xs font-bold text-amber-800">รายการนี้กำลังดำเนินการและป้องกันการสร้างคำสั่งซื้อซ้ำ</p> : null}
      </div>
      <div className="text-right"><strong className="block text-xl">{Number(order.amount).toLocaleString("th-TH")} บาท</strong><OrderStatus value={order.status} /></div>
    </div>
    {latestPayment?.rejectionNote ? <p className="form-alert error mt-3">ปฏิเสธ: {latestPayment.rejectionNote}</p> : null}
    {order.status === "PENDING_PAYMENT" ? <div className="mt-4">
      <label className="secondary-button inline-flex cursor-pointer">
        <Upload size={17} /> ส่งสลิป
        <input accept="image/png,image/jpeg,application/pdf" className="sr-only" disabled={submitting} onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          // ล้างค่าเพื่อให้เลือกไฟล์เดิมซ้ำได้
          event.target.value = "";
          void onUpload(order.id, file);
        }} type="file" />
      </label>
      <p className="mt-2 flex items-center gap-1 text-xs text-[#73757d]"><AlertCircle size={13} /> PNG, JPG หรือ PDF ขนาดไม่เกิน 5 MB · คำสั่งซื้อหมดอายุ {new Date(order.expiresAt).toLocaleString("th-TH")}</p>
    </div> : null}
    {order.status === "PENDING_REVIEW" ? <p className="mt-3 flex items-center gap-2 text-sm text-amber-700"><Clock3 size={16} /> ส่งหลักฐานแล้ว รอ Super Admin ตรวจสอบ ไม่ต้องส่งซ้ำ</p> : null}
    {order.status === "PAID" ? <p className="mt-3 flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={16} /> เปิดใช้งานแล้ว {order.activatedAt ? new Date(order.activatedAt).toLocaleString("th-TH") : ""}</p> : null}
  </article>;
}

// หนึ่งช่วงบนเส้นเวลา ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function TimelineStep({ active, icon, label, value }: Readonly<{ active: boolean; icon: React.ReactNode; label: string; value: string }>) {
  return <div className={`rounded-2xl border p-4 ${active ? "border-brand/30 bg-brand/[.05]" : "border-[#e3e4e8]"}`}><div className="flex items-center gap-2"><span className={active ? "text-brand" : "text-[#9a9ca5]"}>{icon}</span><strong>{label}</strong></div><p className="mt-2 text-sm text-[#73757d]">{value}</p></div>;
}

// แปลงสถานะของคำสั่งซื้อเป็นคำไทย Record บังคับให้ครอบคลุมทุกสถานะตั้งแต่ตอนคอมไพล์
function OrderStatus({ value }: Readonly<{ value: Order["status"] }>) {
  const labels: Record<Order["status"], string> = {
    PENDING_PAYMENT: "รอชำระ", PENDING_REVIEW: "รอตรวจสอบ", PAID: "เปิดใช้งานแล้ว",
    REJECTED: "ไม่ผ่าน", CANCELLED: "ยกเลิก", EXPIRED: "หมดอายุ",
  };
  return <span className={`badge ${value === "PAID" ? "badge-paid" : ""}`}>{labels[value]}</span>;
}
