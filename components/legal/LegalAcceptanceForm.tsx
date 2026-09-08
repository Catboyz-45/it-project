"use client";

/** แบบฟอร์มบังคับสำหรับบัญชีเดิม พร้อมตัวเลือกการตลาดที่ไม่เลือกไว้ล่วงหน้า */
import { FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function LegalAcceptanceForm({ redirectTo }: { redirectTo: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/legal/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept-required",
          termsAccepted: data.get("termsAccepted") === "on",
          privacyAcknowledged: data.get("privacyAcknowledged") === "on",
          marketingConsent: data.get("marketingConsent") === "on",
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "บันทึกการยืนยันไม่สำเร็จ");
      window.location.assign(redirectTo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกการยืนยันไม่สำเร็จ");
      setPending(false);
    }
  }

  return <form className="legal-acceptance-form" onSubmit={submit}>
    <div className="legal-notice-callout"><ShieldCheck aria-hidden="true" /><p><strong>เราแยกสิ่งที่จำเป็นออกจากสิ่งที่เลือกได้</strong><br />การรับข่าวสารไม่ส่งผลต่อการใช้งานบัญชี และสามารถเปลี่ยนภายหลังได้</p></div>
    <fieldset className="legal-consent-fields">
      <legend>เอกสารที่เกี่ยวข้อง</legend>
      <label className="legal-checkbox"><input name="termsAccepted" required type="checkbox" /><span>ฉันอ่านและยอมรับ <a href="/legal/terms" rel="noreferrer" target="_blank">ข้อกำหนดการใช้บริการ</a> <strong>(จำเป็น)</strong></span></label>
      <label className="legal-checkbox"><input name="privacyAcknowledged" required type="checkbox" /><span>ฉันรับทราบ <a href="/legal/privacy" rel="noreferrer" target="_blank">ประกาศความเป็นส่วนตัว</a> <strong>(จำเป็น)</strong></span></label>
      <label className="legal-checkbox"><input name="marketingConsent" type="checkbox" /><span>ฉันยินยอมรับข่าวสารและคำแนะนำจาก Nestly (ไม่บังคับ)</span></label>
    </fieldset>
    {error ? <p className="login-form-error" role="alert">{error}</p> : null}
    <button className="primary-button w-full" disabled={pending} type="submit">{pending ? "กำลังบันทึก..." : <>ยืนยันและใช้งานต่อ <ArrowRight size={18} /></>}</button>
  </form>;
}
