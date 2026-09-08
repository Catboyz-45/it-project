"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Tenant Registration Form” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Tenant Registration Form” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function TenantRegistrationForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/tenant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationCode: data.get("invitationCode"),
          displayName: data.get("displayName"),
          email: data.get("email"),
          phone: data.get("phone"),
          password: data.get("password"),
          termsAccepted: data.get("termsAccepted") === "on",
          privacyAcknowledged: data.get("privacyAcknowledged") === "on",
          marketingConsent: data.get("marketingConsent") === "on",
        }),
      });
      const payload = await response.json() as { data?: { message: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "สมัครผู้เช่าไม่สำเร็จ");
      setMessage(payload.data.message);
      event.currentTarget.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "สมัครผู้เช่าไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return <form className="login-form tenant-registration-form" onSubmit={submit}>
    <label className="tenant-invitation-field">รหัสเชิญจากหอพัก
      <input autoComplete="off" minLength={32} name="invitationCode" placeholder="วางรหัสเชิญที่ได้รับ" required />
    </label>
    <fieldset className="legal-consent-fields">
      <legend>ข้อตกลงและการใช้ข้อมูล</legend>
      <label className="legal-checkbox">
        <input name="termsAccepted" required type="checkbox" />
        <span>ฉันอ่านและยอมรับ <a href="/legal/terms" rel="noreferrer" target="_blank">ข้อกำหนดการใช้บริการ</a> <strong>(จำเป็น)</strong></span>
      </label>
      <label className="legal-checkbox">
        <input name="privacyAcknowledged" required type="checkbox" />
        <span>ฉันรับทราบ <a href="/legal/privacy" rel="noreferrer" target="_blank">ประกาศความเป็นส่วนตัว</a> <strong>(จำเป็น)</strong></span>
      </label>
      <label className="legal-checkbox">
        <input name="marketingConsent" type="checkbox" />
        <span>ฉันยินยอมรับข่าวสารและคำแนะนำจาก Nestly (ไม่บังคับและเปลี่ยนภายหลังได้)</span>
      </label>
    </fieldset>
    <label>ชื่อผู้เช่า
      <input autoComplete="name" maxLength={120} minLength={2} name="displayName" placeholder="ชื่อที่ใช้ในระบบ" required />
    </label>
    <label>อีเมล
      <input autoComplete="email" name="email" placeholder="name@example.com" required type="email" />
    </label>
    <label>เบอร์โทรศัพท์
      <input autoComplete="tel" minLength={8} name="phone" placeholder="08x xxx xxxx" required type="tel" />
    </label>
    <label>รหัสผ่าน
      <input
        aria-describedby="tenant-password-help"
        autoComplete="new-password"
        maxLength={128}
        minLength={12}
        name="password"
        placeholder="ตั้งรหัสผ่าน"
        required
        type="password"
      />
      <small id="tenant-password-help">อย่างน้อย 12 ตัว พร้อมตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข</small>
    </label>
    {error ? <p className="login-form-error tenant-form-feedback" role="alert">{error}</p> : null}
    {message ? <div className="tenant-form-success tenant-form-feedback" role="status">
      <CheckCircle2 className="mb-2" />
      <strong>{message}</strong>
      <a className="mt-2 block underline" href="/login">ไปหน้าเข้าสู่ระบบ</a>
    </div> : null}
    <button className="primary-button w-full" disabled={pending} type="submit">
      {pending ? "กำลังสมัคร..." : <>สมัครเป็นผู้เช่า <ArrowRight size={18} /></>}
    </button>
  </form>;
}
