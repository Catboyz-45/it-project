"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Super Admin Forms” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { DropdownField } from "@/components/dorm/DropdownField";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Property Option” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type PropertyOption = { id: string; name: string };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Plan Option” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type PlanOption = { id: string; name: string; maxRooms: number };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “post Json” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - url: ค่า “url” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - body: ค่า “body” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Super Admin Form Section” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type SuperAdminFormSection = "property" | "account" | "subscription";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Super Admin Forms” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { sections = ["property", "account", "subscription"], }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SuperAdminForms({
  sections = ["property", "account", "subscription"],
}: {
  sections?: SuperAdminFormSection[];
}) {
  const showProperty = sections.includes("property");
  const showAccount = sections.includes("account");
  const showSubscription = sections.includes("subscription");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [propertyPage, setPropertyPage] = useState(1);
  const [planPage, setPlanPage] = useState(1);
  const [hasMoreProperties, setHasMoreProperties] = useState(false);
  const [hasMorePlans, setHasMorePlans] = useState(false);
  const [propertyQuery, setPropertyQuery] = useState("");
  const [planQuery, setPlanQuery] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [subscriptionPropertyId, setSubscriptionPropertyId] = useState("");
  const [subscriptionPlanId, setSubscriptionPlanId] = useState("");
  const [billingInterval, setBillingInterval] = useState("MONTHLY");
  const [openDialog, setOpenDialog] = useState<"property" | "account" | null>(null);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close Dialog” ตามกฎของระบบ
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  function closeDialog() {
    if (pending) return;
    setMessage("");
    setOpenDialog(null);
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Properties” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadProperties = useCallback(async (page: number, append: boolean) => {
    const search = new URLSearchParams({
      page: String(page), pageSize: "20", activeOnly: "true", query: propertyQuery,
    });
    const response = await fetch(`/api/v1/super-admin/properties?${search}`, { cache: "no-store" });
    const result = await response.json() as {
      data?: PropertyOption[]; error?: string; pageInfo?: { hasNextPage: boolean };
    };
    if (!response.ok || !result.data || !result.pageInfo) throw new Error(result.error || "โหลดหอพักไม่สำเร็จ");
    setProperties((current) => append ? [...current, ...result.data!] : result.data!);
    setPropertyPage(page);
    setHasMoreProperties(result.pageInfo.hasNextPage);
  }, [propertyQuery]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Plans” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - append: ค่า “append” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadPlans = useCallback(async (page: number, append: boolean) => {
    const search = new URLSearchParams({
      page: String(page), pageSize: "20", activeOnly: "true", query: planQuery,
    });
    const response = await fetch(`/api/v1/super-admin/plans?${search}`, { cache: "no-store" });
    const result = await response.json() as {
      data?: PlanOption[]; error?: string; pageInfo?: { hasNextPage: boolean };
    };
    if (!response.ok || !result.data || !result.pageInfo) throw new Error(result.error || "โหลดแพ็กเกจไม่สำเร็จ");
    setPlans((current) => append ? [...current, ...result.data!] : result.data!);
    setPlanPage(page);
    setHasMorePlans(result.pageInfo.hasNextPage);
  }, [planQuery]);

  useEffect(() => {
    if (!showAccount && !showSubscription) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “timeout” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const timeout = window.setTimeout(() => {
      void loadProperties(1, false).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "โหลดหอพักไม่สำเร็จ"));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [loadProperties, showAccount, showSubscription]);

  useEffect(() => {
    if (!showSubscription) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “timeout” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const timeout = window.setTimeout(() => {
      void loadPlans(1, false).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "โหลดแพ็กเกจไม่สำเร็จ"));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [loadPlans, showSubscription]);

  useEffect(() => {
    setSubscriptionPropertyId((current) => properties.some(({ id }) => id === current) ? current : properties[0]?.id ?? "");
  }, [properties]);

  useEffect(() => {
    setSubscriptionPlanId((current) => plans.some(({ id }) => id === current) ? current : plans[0]?.id ?? "");
  }, [plans]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit Property” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function submitProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/super-admin/properties", { name: form.get("name"), shortName: form.get("shortName") });
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); setPending(false); }
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit Admin” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function submitAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/super-admin/users", {
        email: form.get("email"),
        displayName: form.get("displayName"),
        password: form.get("password"),
        propertyIds: selectedPropertyIds,
      });
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); setPending(false); }
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit Subscription” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function submitSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const propertyId = subscriptionPropertyId;
    if (!propertyId || !subscriptionPlanId) {
      setMessage("กรุณาเลือกหอพักและแพ็กเกจ");
      setPending(false);
      return;
    }
    try {
      const startsAt = new Date(String(form.get("startsAt")));
      const expiresAt = new Date(String(form.get("expiresAt")));
      const response = await fetch(`/api/v1/super-admin/properties/${propertyId}/subscription`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: subscriptionPlanId, status: "ACTIVE",
          billingInterval, startsAt, expiresAt,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "กำหนดแพ็กเกจไม่สำเร็จ");
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "กำหนดแพ็กเกจไม่สำเร็จ"); setPending(false); }
  }

  return <>
    {showProperty ? <>
      <button className="primary-button" onClick={() => { setMessage(""); setOpenDialog("property"); }} type="button"><Plus size={18} /> เพิ่มหอพัก</button>
      {openDialog === "property" ? <Dialog ariaDescribedBy="property-create-description" ariaLabelledBy="property-create-title" onClose={closeDialog}>
        <header className="modal-header"><div><h2 id="property-create-title">เพิ่มหอพัก</h2><p id="property-create-description">สร้างพื้นที่ใหม่สำหรับเจ้าของหอและผู้เช่าในระบบ</p></div><IconButton disabled={pending} label="ปิด" onClick={closeDialog} tooltip="ปิดหน้าต่างเพิ่มหอพัก"><X /></IconButton></header>
        <form className="modal-form" onSubmit={submitProperty}>
          <label>ชื่อเต็ม <input maxLength={160} minLength={2} name="name" required /></label>
          <label>ชื่อย่อ <input maxLength={80} name="shortName" required /></label>
          {message ? <p className="form-alert error" role="alert">{message}</p> : null}
          <footer className="modal-actions"><button disabled={pending} onClick={closeDialog} type="button">ยกเลิก</button><button className="primary-button" disabled={pending} type="submit"><Plus size={18} /> {pending ? "กำลังเพิ่ม..." : "เพิ่มหอพัก"}</button></footer>
        </form>
      </Dialog> : null}
    </> : null}
    {showAccount ? <>
      <button className="primary-button" onClick={() => { setMessage(""); setOpenDialog("account"); }} type="button"><UserPlus size={18} /> เพิ่มแอดมินประจำหอ</button>
      {openDialog === "account" ? <Dialog ariaDescribedBy="admin-create-description" ariaLabelledBy="admin-create-title" onClose={closeDialog}>
        <header className="modal-header"><div><h2 id="admin-create-title">เพิ่มแอดมินประจำหอ</h2><p id="admin-create-description">สร้างบัญชีผู้ดูแลและกำหนดหอพักที่รับผิดชอบ</p></div><IconButton disabled={pending} label="ปิด" onClick={closeDialog} tooltip="ปิดหน้าต่างเพิ่มแอดมิน"><X /></IconButton></header>
        <form className="modal-form" onSubmit={submitAdmin}>
          <div className="modal-grid">
            <label>ชื่อ <input maxLength={120} minLength={2} name="displayName" required /></label>
            <label>อีเมล <input maxLength={254} name="email" required type="email" /></label>
          </div>
          <label>รหัสผ่านชั่วคราว <input autoComplete="new-password" maxLength={128} minLength={12} name="password" required type="password" /></label>
          <label>ค้นหาหอพัก <input onChange={(event) => setPropertyQuery(event.target.value)} placeholder="ชื่อหรือชื่อย่อ" value={propertyQuery} /></label>
          <fieldset className="grid max-h-64 gap-2 overflow-y-auto"><legend>หอพักที่ดูแล</legend>{properties.map((property) =>
            <label className="rounded-xl bg-[#f6f7fa] px-3" key={property.id}><input checked={selectedPropertyIds.includes(property.id)} onChange={(event) => setSelectedPropertyIds((current) => event.target.checked ? [...new Set([...current, property.id])] : current.filter((id) => id !== property.id))} type="checkbox" /> {property.name}</label>
          )}{propertyQuery.trim() && properties.length === 0 ? <SearchEmptyState description="ลองใช้ชื่อหรือชื่อย่ออื่น" title="ไม่พบหอพักที่ค้นหา" /> : null}{hasMoreProperties ? <button className="secondary-button" onClick={() => void loadProperties(propertyPage + 1, true)} type="button">โหลดหอพักเพิ่มเติม</button> : null}</fieldset>
          {message ? <p className="form-alert error" role="alert">{message}</p> : null}
          {!pending && properties.length === 0 ? <p className="disabled-reason" id="admin-account-disabled-reason">ต้องมีหอพักอย่างน้อย 1 แห่งก่อนสร้างบัญชีแอดมิน</p> : null}
          <footer className="modal-actions"><button disabled={pending} onClick={closeDialog} type="button">ยกเลิก</button><button aria-describedby={!pending && properties.length === 0 ? "admin-account-disabled-reason" : undefined} className="primary-button" disabled={pending || properties.length === 0} type="submit"><UserPlus size={18} /> {pending ? "กำลังสร้าง..." : "สร้างบัญชี"}</button></footer>
        </form>
      </Dialog> : null}
    </> : null}
    {showSubscription ? <div className="grid gap-5">
      {message ? <p className="form-alert error" role="alert">{message}</p> : null}
      <section className="panel">
      <div className="mb-5"><h2 className="text-xl font-black">Admin override แพ็กเกจ SaaS</h2><p className="text-sm text-[#62646c]">ใช้เฉพาะกรณีช่วยเหลือลูกค้าหรือแก้สถานะด้วย Super Admin; การซื้อปกติทำผ่านคำสั่งซื้อของเจ้าของหอ</p></div>
      <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={submitSubscription}>
        <label>ค้นหาหอพัก<input onChange={(event) => setPropertyQuery(event.target.value)} placeholder="ชื่อหรือชื่อย่อ" value={propertyQuery} /></label>
        <div><DropdownField label="หอพัก" onChange={setSubscriptionPropertyId} options={properties.map((property) => ({ label: property.name, value: property.id }))} value={subscriptionPropertyId} />{hasMoreProperties ? <button onClick={() => void loadProperties(propertyPage + 1, true)} type="button">โหลดเพิ่ม</button> : null}</div>
        <label>ค้นหาแพ็กเกจ<input onChange={(event) => setPlanQuery(event.target.value)} placeholder="ชื่อหรือรหัส" value={planQuery} /></label>
        <div><DropdownField label="แพ็กเกจ" onChange={setSubscriptionPlanId} options={plans.map((plan) => ({ label: `${plan.name} · ${plan.maxRooms} ห้อง`, value: plan.id }))} value={subscriptionPlanId} />{hasMorePlans ? <button onClick={() => void loadPlans(planPage + 1, true)} type="button">โหลดเพิ่ม</button> : null}</div>
        {propertyQuery.trim() && properties.length === 0 ? <div className="md:col-span-2 xl:col-span-5"><SearchEmptyState description="ลองใช้ชื่อหรือชื่อย่ออื่น" title="ไม่พบหอพักที่ค้นหา" /></div> : null}
        {planQuery.trim() && plans.length === 0 ? <div className="md:col-span-2 xl:col-span-5"><SearchEmptyState description="ลองใช้ชื่อหรือรหัสแพ็กเกจอื่น" title="ไม่พบแพ็กเกจที่ค้นหา" /></div> : null}
        <DropdownField label="รอบบิล" onChange={setBillingInterval} options={[{ label: "รายเดือน", value: "MONTHLY" }, { label: "รายปี", value: "YEARLY" }]} value={billingInterval} />
        <label>เริ่มใช้งาน<input defaultValue={new Date().toISOString().slice(0, 10)} name="startsAt" required type="date" /></label>
        <label>หมดอายุ<input name="expiresAt" required type="date" /></label>
        <button aria-describedby={!pending && (properties.length === 0 || plans.length === 0) ? "subscription-override-disabled-reason" : undefined} className="primary-button md:col-span-2 xl:col-span-5" disabled={pending || properties.length === 0 || plans.length === 0} type="submit">บันทึกแพ็กเกจ</button>
        {!pending && (properties.length === 0 || plans.length === 0) ? <p className="disabled-reason md:col-span-2 xl:col-span-5" id="subscription-override-disabled-reason">{properties.length === 0 ? "ต้องมีหอพักก่อนกำหนดแพ็กเกจ" : "ต้องมีแพ็กเกจอย่างน้อย 1 รายการก่อนบันทึก"}</p> : null}
      </form>
      </section>
    </div> : null}
  </>;
}
