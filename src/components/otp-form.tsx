"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, KeyRound, LoaderCircle, RefreshCw } from "lucide-react";

export function OtpForm({ setup = false }: { setup?: boolean }) {
  const router = useRouter();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<"invalid" | "expired" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits(current => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    setError(null);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }
  function keyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
  }
  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (value.length === 6) { event.preventDefault(); setDigits(value.split("")); refs.current[5]?.focus(); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) { setError("invalid"); return; }
    setSubmitting(true);
    const response = await fetch(setup ? "/api/auth/2fa/setup/verify" : "/api/auth/2fa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
    if (!response?.ok) { setSubmitting(false); setError(response?.status === 401 ? "expired" : "invalid"); return; }
    const result = await response.json() as { next: string; recoveryCodes?: string[] };
    if (result.recoveryCodes) sessionStorage.setItem("yuyen-recovery-codes", JSON.stringify(result.recoveryCodes));
    router.replace(result.next); router.refresh();
  }
  return <><div className="icon-box"><KeyRound size={22} /></div><p className="eyebrow" style={{ marginTop: 26 }}>{setup ? "VERIFY AUTHENTICATOR" : "TWO-FACTOR AUTHENTICATION"}</p><h2 className="heading">{setup ? "ยืนยันการตั้งค่า" : "ยืนยันตัวตน"}</h2><p className="muted">กรอกรหัส 6 หลักจากแอป Authenticator รหัสจะเปลี่ยนทุก 30 วินาที</p>{error && <div className="auth-alert error" role="alert"><AlertCircle size={19} /><div><strong>{error === "expired" ? "รหัสไม่ถูกต้องหรือหมดอายุ" : "รหัสไม่ครบหรือไม่ถูกต้อง"}</strong><p>{error === "expired" ? "รอรหัสชุดใหม่แล้วลองอีกครั้ง" : "ตรวจสอบรหัสในแอป Authenticator แล้วกรอกใหม่"}</p></div></div>}<form className="form-stack" onSubmit={submit}><fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="sr-only">รหัส OTP 6 หลัก</legend><div className="otp-inputs">{digits.map((digit, index) => <input key={index} ref={element => { refs.current[index] = element; }} value={digit} onChange={event => update(index, event.target.value)} onKeyDown={event => keyDown(index, event)} onPaste={paste} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} aria-label={`หลักที่ ${index + 1}`} />)}</div></fieldset><button className="btn btn-dark" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={18} /> กำลังยืนยัน</> : <>ยืนยันและดำเนินการต่อ <ArrowRight size={17} /></>}</button></form><button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => { setDigits(["", "", "", "", "", ""]); setError(null); refs.current[0]?.focus(); }}><RefreshCw size={16} /> ล้างรหัส</button></>;
}
