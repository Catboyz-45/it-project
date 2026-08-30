/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React login-form ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldAlert } from "lucide-react";

type LoginState = "idle" | "error" | "locked" | "submitting";

/** สร้างส่วนหน้าจอ LoginForm; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<LoginState>("idle");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "locked") return;
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!username || password.length < 8) { setState("error"); return; }
    setState("submitting");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }).catch(() => null);
    if (!response) { setState("error"); return; }
    if (response.status === 429) { setState("locked"); return; }
    if (!response.ok) { setState("error"); return; }
    const result = await response.json() as { next: string }; router.replace(result.next); router.refresh();
  }

  return (
    <>
      <div className="icon-box"><LockKeyhole size={22} /></div>
      <p className="eyebrow" style={{ marginTop: 26 }}>ADMIN PORTAL</p>
      <h2 className="heading">เข้าสู่ระบบ</h2>
      <p className="muted">กรอกชื่อผู้ใช้และรหัสผ่านเพื่อดำเนินการต่อ</p>

      {state === "error" && <div className="auth-alert error" role="alert"><AlertCircle size={19} /><div><strong>เข้าสู่ระบบไม่สำเร็จ</strong><p>ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง</p></div></div>}
      {state === "locked" && <div className="auth-alert warning" role="alert"><ShieldAlert size={19} /><div><strong>บัญชีถูกระงับชั่วคราว</strong><p>มีการลองเข้าสู่ระบบหลายครั้ง กรุณารอ 15 นาที หรือติดต่อ Super Admin</p></div></div>}

      <form className="form-stack" onSubmit={submit} noValidate>
        <div className="form-group"><label htmlFor="username">ชื่อผู้ใช้</label><input className="field" id="username" name="username" autoComplete="username" placeholder="กรอกชื่อผู้ใช้" disabled={state === "locked" || state === "submitting"} required /></div>
        <div className="form-group"><div className="cluster" style={{ justifyContent: "space-between" }}><label htmlFor="password">รหัสผ่าน</label><span className="muted" style={{ fontSize: ".75rem" }}>ติดต่อ Super Admin หากลืมรหัสผ่าน</span></div><div className="password-field"><input className="field" id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" disabled={state === "locked" || state === "submitting"} required /><button type="button" className="icon-btn" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
        <button className="btn btn-dark" disabled={state === "locked" || state === "submitting"}>{state === "submitting" ? <><LoaderCircle className="spin" size={18} /> กำลังตรวจสอบ</> : <>เข้าสู่ระบบ <ArrowRight size={17} /></>}</button>
      </form>
      <p className="muted" style={{ marginTop: 24, fontSize: ".75rem" }}>ระบบจำกัดจำนวนครั้งที่เข้าสู่ระบบไม่สำเร็จ และไม่เปิดเผยว่าชื่อผู้ใช้มีอยู่หรือไม่</p>
    </>
  );
}
