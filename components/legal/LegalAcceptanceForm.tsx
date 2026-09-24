"use client";

// เป็น Client Component เพราะต้องรับการติ๊กและกดปุ่มจากผู้ใช้
import { SyntheticEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function LegalAcceptanceForm({ redirectTo }: Readonly<{ redirectTo: string }>) {
  // pending ใช้ปิดปุ่มระหว่างรอ กันผู้ใช้กดรัวจนส่งซ้ำหลายรอบ
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์ส่งฟอร์มแบบเดิมที่ทำให้หน้าโหลดใหม่ทั้งหน้า
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/legal/preferences", {
        method: "POST",
        // ต้องเป็น JSON ฝั่งเซิร์ฟเวอร์ถึงจะรับ เป็นส่วนหนึ่งของการกัน CSRF
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept-required",
          // checkbox ที่ติ๊กแล้วส่งค่ามาเป็น "on" แปลงเป็น true/false ก่อนส่ง
          termsAccepted: data.get("termsAccepted") === "on",
          privacyAcknowledged: data.get("privacyAcknowledged") === "on",
          marketingConsent: data.get("marketingConsent") === "on",
        }),
      });
      const payload = await response.json() as { error?: string };
      // ใช้ข้อความจากเซิร์ฟเวอร์ถ้ามี ไม่มีก็ใช้ข้อความกลางแทน
      if (!response.ok) throw new Error(payload.error || "บันทึกการยืนยันไม่สำเร็จ");
      // โหลดหน้าใหม่ทั้งหน้าแทนการเปลี่ยนเส้นทางแบบ client เพื่อให้ Server Component อ่านสถานะใหม่
      window.location.assign(redirectTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกการยืนยันไม่สำเร็จ");
      // ปลดล็อกปุ่มเฉพาะตอนพลาด ถ้าสำเร็จหน้าจะเปลี่ยนไปแล้วจึงไม่ต้องปลด
      setPending(false);
    }
  }

  return <form className="legal-acceptance-form" onSubmit={submit}>
    <div className="legal-notice-callout"><ShieldCheck aria-hidden="true" /><p><strong>เราแยกสิ่งที่จำเป็นออกจากสิ่งที่เลือกได้</strong><br />การรับข่าวสารไม่ส่งผลต่อการใช้งานบัญชี และสามารถเปลี่ยนภายหลังได้</p></div>
    <fieldset className="legal-consent-fields">
      <legend>เอกสารที่เกี่ยวข้อง</legend>
      <label className="legal-checkbox"><input name="termsAccepted" required type="checkbox" /><span>ฉันอ่านและยอมรับ <a href="/legal/terms" rel="noreferrer" target="_blank">ข้อกำหนดการใช้บริการ</a> <strong>(จำเป็น)</strong></span></label>
      <label className="legal-checkbox"><input name="privacyAcknowledged" required type="checkbox" /><span>ฉันรับทราบ <a href="/legal/privacy" rel="noreferrer" target="_blank">ประกาศความเป็นส่วนตัว</a> <strong>(จำเป็น)</strong></span></label>
      {/* ช่องรับข่าวสารไม่ติ๊กไว้ล่วงหน้าและไม่ใส่ required ความยินยอมต้องมาจากผู้ใช้กดเอง */}
      <label className="legal-checkbox"><input name="marketingConsent" type="checkbox" /><span>ฉันยินยอมรับข่าวสารและคำแนะนำจาก Nestly (ไม่บังคับ)</span></label>
    </fieldset>
    {/* role="alert" ทำให้โปรแกรมอ่านหน้าจออ่านข้อความผิดพลาดทันทีที่ขึ้น */}
    {error ? <p className="login-form-error" role="alert">{error}</p> : null}
    <button className="primary-button w-full" disabled={pending} type="submit">{pending ? "กำลังบันทึก..." : <>ยืนยันและใช้งานต่อ <ArrowRight size={18} /></>}</button>
  </form>;
}
