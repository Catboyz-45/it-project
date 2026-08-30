/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React auth-forms ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useUI } from "./ui-feedback";

/** สร้างส่วนหน้าจอ LoginForm; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const data = new FormData(event.currentTarget);
    if (!String(data.get("username") ?? "").trim() || String(data.get("password") ?? "").length < 8) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setError("");
    setIsSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    router.push("/verify-2fa");
  }
  return <form className="form-stack" onSubmit={submit} noValidate>{error && <div className="form-notice" role="alert">{error}</div>}<div className="form-group"><label htmlFor="username">ชื่อผู้ใช้</label><input className="field" id="username" name="username" autoComplete="username" placeholder="กรอกชื่อผู้ใช้" aria-invalid={Boolean(error)} /></div><div className="form-group"><div className="cluster" style={{ justifyContent: "space-between" }}><label htmlFor="password">รหัสผ่าน</label><span className="muted" style={{ fontSize: ".75rem" }}>ติดต่อ Super Admin หากลืมรหัสผ่าน</span></div><input className="field" id="password" name="password" type="password" autoComplete="current-password" placeholder="กรอกรหัสผ่าน" aria-invalid={Boolean(error)} /></div><button className="btn btn-dark" disabled={isSubmitting}>{isSubmitting ? "กำลังตรวจสอบ…" : <>เข้าสู่ระบบ <ArrowRight size={17} /></>}</button></form>;
}

/** สร้างส่วนหน้าจอ OTPForm; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function OTPForm() {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const router = useRouter();
  const { toast } = useUI();
  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  };
  const paste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (value.length !== 6) return;
    event.preventDefault();
    setDigits(value.split(""));
    inputs.current[5]?.focus();
  };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (digits.join("").length !== 6) { toast("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก", "error"); return; }
    setIsSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    toast("ยืนยันตัวตนสำเร็จ");
    router.push("/admin");
  }
  return <form className="form-stack" onSubmit={submit}><fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="sr-only">รหัส OTP 6 หลัก</legend><div className="otp-inputs">{digits.map((digit, index) => <input key={index} ref={(element) => { inputs.current[index] = element; }} value={digit} onChange={(event) => updateDigit(index, event.target.value)} onPaste={paste} onKeyDown={(event) => { if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus(); }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} aria-label={`หลักที่ ${index + 1}`} />)}</div></fieldset><button className="btn btn-dark" disabled={isSubmitting || digits.some((digit) => !digit)}>{isSubmitting ? "กำลังยืนยัน…" : <>ยืนยันและเข้าสู่ระบบ <ArrowRight size={17} /></>}</button></form>;
}
