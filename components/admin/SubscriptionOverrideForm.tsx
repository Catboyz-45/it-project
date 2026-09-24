"use client";
// แก้แพ็กเกจของหอด้วยสิทธิ์ผู้ดูแลระบบ ใช้เฉพาะตอนช่วยเหลือลูกค้าหรือแก้สถานะ

import { SyntheticEvent, useState } from "react";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { DatePickerField } from "@/components/dorm/DatePickerField";
import { DropdownField } from "@/components/dorm/DropdownField";
import {
  type PlanOption,
  type PropertyOption,
  usePagedOptions,
  useSelectionWithinOptions,
} from "@/components/admin/super-admin-options";

// ตรวจค่าที่กรอกก่อนส่ง คืนข้อความว่างเมื่อผ่านทุกข้อ
// ทุกช่องในฟอร์มนี้เก็บค่าไว้ใน state ไม่ได้อ่านจาก FormData จึงต้องเช็คเอง
// และปฏิทินที่เขียนเองก็ไม่มี required ของเบราว์เซอร์ให้พึ่ง
function validationError({ expiresAt, planId, propertyId, startsAt }: {
  expiresAt: string;
  planId: string;
  propertyId: string;
  startsAt: string;
}) {
  if (!propertyId || !planId) return "กรุณาเลือกหอพักและแพ็กเกจ";
  if (!startsAt || !expiresAt || expiresAt < startsAt) return "กรุณาตรวจสอบวันเริ่มใช้งานและวันหมดอายุ";
  return "";
}

// PUT เพราะหอหนึ่งมีแพ็กเกจที่ใช้งานอยู่ได้ใบเดียว ส่งไปคือแทนที่ของเดิม
async function saveSubscriptionRequest(propertyId: string, body: unknown) {
  const response = await fetch(`/api/v1/super-admin/properties/${propertyId}/subscription`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error || "กำหนดแพ็กเกจไม่สำเร็จ");
}

export function SubscriptionOverrideForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [billingInterval, setBillingInterval] = useState("MONTHLY");
  // ปฏิทินที่เขียนเองเก็บค่าไว้ใน state ไม่ใช่ใน FormData แบบ input ของเบราว์เซอร์
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState("");

  const properties = usePagedOptions<PropertyOption>({
    endpoint: "/api/v1/super-admin/properties",
    errorMessage: "โหลดหอพักไม่สำเร็จ",
    onError: setMessage,
  });
  const plans = usePagedOptions<PlanOption>({
    endpoint: "/api/v1/super-admin/plans",
    errorMessage: "โหลดแพ็กเกจไม่สำเร็จ",
    onError: setMessage,
  });
  const [propertyId, setPropertyId] = useSelectionWithinOptions(properties.items);
  const [planId, setPlanId] = useSelectionWithinOptions(plans.items);

  const blocked = properties.items.length === 0 || plans.items.length === 0;
  const blockedReason = properties.items.length === 0 ? "ต้องมีหอพักก่อนกำหนดแพ็กเกจ" : "ต้องมีแพ็กเกจอย่างน้อย 1 รายการก่อนบันทึก";

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const problem = validationError({ expiresAt, planId, propertyId, startsAt });
    if (problem) {
      setMessage(problem);
      setPending(false);
      return;
    }
    try {
      await saveSubscriptionRequest(propertyId, {
        planId,
        status: "ACTIVE",
        billingInterval,
        startsAt: new Date(`${startsAt}T00:00:00`),
        expiresAt: new Date(`${expiresAt}T00:00:00`),
      });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "กำหนดแพ็กเกจไม่สำเร็จ");
      setPending(false);
    }
  };

  return <div className="grid gap-5">
    {message ? <p className="form-alert error" role="alert">{message}</p> : null}
    <section className="panel">
      <div className="mb-5"><h2 className="text-base font-semibold">Admin override แพ็กเกจ SaaS</h2><p className="text-sm text-[#62646c]">ใช้เฉพาะกรณีช่วยเหลือลูกค้าหรือแก้สถานะด้วย Super Admin; การซื้อปกติทำผ่านคำสั่งซื้อของเจ้าของหอ</p></div>
      <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
        <label>ค้นหาหอพัก<input onChange={(event) => properties.setQuery(event.target.value)} placeholder="ชื่อหรือชื่อย่อ" value={properties.query} /></label>
        <div>
          <DropdownField label="หอพัก" onChange={setPropertyId} options={properties.items.map((property) => ({ label: property.name, value: property.id }))} value={propertyId} />
          {properties.hasMore ? <button onClick={properties.loadMore} type="button">โหลดเพิ่ม</button> : null}
        </div>
        <label>ค้นหาแพ็กเกจ<input onChange={(event) => plans.setQuery(event.target.value)} placeholder="ชื่อหรือรหัส" value={plans.query} /></label>
        <div>
          <DropdownField label="แพ็กเกจ" onChange={setPlanId} options={plans.items.map((plan) => ({ label: `${plan.name} · ${plan.maxRooms} ห้อง`, value: plan.id }))} value={planId} />
          {plans.hasMore ? <button onClick={plans.loadMore} type="button">โหลดเพิ่ม</button> : null}
        </div>
        {properties.query.trim() && properties.items.length === 0 ? <div className="md:col-span-2 xl:col-span-5"><SearchEmptyState description="ลองใช้ชื่อหรือชื่อย่ออื่น" title="ไม่พบหอพักที่ค้นหา" /></div> : null}
        {plans.query.trim() && plans.items.length === 0 ? <div className="md:col-span-2 xl:col-span-5"><SearchEmptyState description="ลองใช้ชื่อหรือรหัสแพ็กเกจอื่น" title="ไม่พบแพ็กเกจที่ค้นหา" /></div> : null}
        <DropdownField label="รอบบิล" onChange={setBillingInterval} options={[{ label: "รายเดือน", value: "MONTHLY" }, { label: "รายปี", value: "YEARLY" }]} value={billingInterval} />
        {/* แพ็กเกจย้อนหลังได้ เช่นมาคีย์ของที่เริ่มไปแล้ว ปฏิทินจึงไม่ปิดวันในอดีต */}
        <DatePickerField label="เริ่มใช้งาน" minDate={new Date(2000, 0, 1)} onChange={setStartsAt} value={startsAt} />
        <DatePickerField
          label="หมดอายุ"
          minDate={startsAt ? new Date(`${startsAt}T00:00:00`) : new Date(2000, 0, 1)}
          onChange={setExpiresAt}
          value={expiresAt}
        />
        <button aria-describedby={!pending && blocked ? "subscription-override-disabled-reason" : undefined} className="primary-button md:col-span-2 xl:col-span-5" disabled={pending || blocked} type="submit">บันทึกแพ็กเกจ</button>
        {!pending && blocked ? <p className="disabled-reason md:col-span-2 xl:col-span-5" id="subscription-override-disabled-reason">{blockedReason}</p> : null}
      </form>
    </section>
  </div>;
}
