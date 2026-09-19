"use client";
// เก็บค่าที่กรอกและส่งคำขอจากเบราว์เซอร์

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

// ขอลิงก์ตั้งรหัสผ่านใหม่ ตอบข้อความเดียวกันเสมอไม่ว่าอีเมลนั้นมีอยู่จริงหรือไม่
// เพื่อไม่ให้ใครใช้หน้านี้ไล่เดาว่าอีเมลไหนสมัครไว้แล้ว
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "ดำเนินการไม่สำเร็จ");
      setMessage(payload.message ?? "โปรดตรวจสอบอีเมล");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setLoading(false); }
  };
  return <form className="login-form" onSubmit={submit}>
    <label>อีเมล <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required type="email" value={email} /></label>
    {message ? <p className="form-alert" role="status">{message}</p> : null}
    {error ? <p className="form-alert error" role="alert">{error}</p> : null}
    <button className="primary-button" disabled={loading} type="submit">{loading ? "กำลังส่ง..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}</button>
  </form>;
}

// ตั้งรหัสผ่านใหม่ ใช้สองกรณี มาจากลิงก์ในอีเมล หรือถูกบังคับให้เปลี่ยนตอนเข้าสู่ระบบ
// forced ไม่ต้องมี token เพราะยืนยันตัวตนจากคุกกี้ session ที่มีอยู่แล้ว
export function SetPasswordForm({ token, forced = false }: { token?: string; forced?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // เทียบสองช่องก่อน ที่เหลือให้เซิร์ฟเวอร์ตรวจ เพราะต้องเช็ค token กับความแข็งแรงของรหัสด้วย
    if (password !== confirm) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(forced ? "/api/auth/change-password" : "/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forced ? { password } : { token, password }),
      });
      const payload = await response.json() as { redirectTo?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "ตั้งรหัสผ่านไม่สำเร็จ");
      // replace ไม่ใช่ push เพราะกดย้อนกลับมาหน้านี้อีกไม่ได้ ลิงก์ตั้งรหัสผ่านใช้ได้ครั้งเดียว
      router.replace(payload.redirectTo ?? "/login");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ตั้งรหัสผ่านไม่สำเร็จ"); }
    finally { setLoading(false); }
  };
  return <form className="grid gap-5" onSubmit={submit}>
    <label>รหัสผ่านใหม่ <input autoComplete="new-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
    <label>ยืนยันรหัสผ่าน <input autoComplete="new-password" minLength={12} onChange={(event) => setConfirm(event.target.value)} required type="password" value={confirm} /></label>
    {/* บอกเกณฑ์ไว้ตั้งแต่แรก ดีกว่าให้กรอกเสร็จแล้วค่อยโดนปฏิเสธ */}
    <p className="text-sm text-[#62646c]">อย่างน้อย 12 ตัวอักษร</p>
    {error ? <p className="form-alert error" role="alert">{error}</p> : null}
    <button className="primary-button" disabled={loading} type="submit">{loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}</button>
  </form>;
}
