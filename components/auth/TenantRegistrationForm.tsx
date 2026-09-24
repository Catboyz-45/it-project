"use client";
// เก็บสถานะของฟอร์มและส่งคำขอสมัครจากเบราว์เซอร์

import { SyntheticEvent, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

// ฟอร์มสมัครของผู้เช่า ต้องมีรหัสเชิญจากหอพัก เพื่อให้ระบบผูกบัญชีกับห้องได้ถูก
// สมัครแล้วยังเข้าใช้งานไม่ได้ทันที ต้องรอเจ้าของหออนุมัติก่อน
export function TenantRegistrationForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
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
          // ช่องติ๊กส่งค่ามาเป็น "on" หรือไม่มีเลย แปลงเป็น true/false ก่อนส่ง
          termsAccepted: data.get("termsAccepted") === "on",
          privacyAcknowledged: data.get("privacyAcknowledged") === "on",
          marketingConsent: data.get("marketingConsent") === "on",
        }),
      });
      const payload = await response.json() as { data?: { message: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "สมัครผู้เช่าไม่สำเร็จ");
      // ล้างฟอร์มเมื่อสมัครสำเร็จเท่านั้น สมัครไม่ผ่านที่กรอกไว้จะได้ยังอยู่ให้แก้
      setMessage(payload.data.message);
      event.currentTarget.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "สมัครผู้เช่าไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return <form className="login-form tenant-registration-form" onSubmit={submit}>
    {/* รหัสเชิญยาว 32 ตัวขึ้นไป ปิด autoComplete เพราะเป็นค่าที่ใช้ครั้งเดียว ไม่ควรให้เบราว์เซอร์จำ */}
    <label className="tenant-invitation-field">รหัสเชิญจากหอพัก
      <input autoComplete="off" minLength={32} name="invitationCode" placeholder="วางรหัสเชิญที่ได้รับ" required />
    </label>
    {/* สองข้อแรกบังคับติ๊ก ส่วนข่าวสารเป็นความสมัครใจและถอนได้ทีหลัง ตามหลักการขอความยินยอม */}
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
        // ผูกคำอธิบายเกณฑ์รหัสผ่านไว้กับช่อง โปรแกรมอ่านหน้าจอจะได้อ่านให้ฟังด้วย
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
    {message ? <output className="tenant-form-success tenant-form-feedback">
      <CheckCircle2 className="mb-2" />
      <strong>{message}</strong>
      <a className="mt-2 block underline" href="/login">ไปหน้าเข้าสู่ระบบ</a>
    </output> : null}
    <button className="primary-button w-full" disabled={pending} type="submit">
      {pending ? "กำลังสมัคร..." : <>สมัครเป็นผู้เช่า <ArrowRight size={18} /></>}
    </button>
  </form>;
}
