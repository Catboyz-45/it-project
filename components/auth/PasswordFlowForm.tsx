"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Password Flow Form” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Forgot Password Form” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submit = async (event: FormEvent) => {
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Set Password Form” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { token, forced = false }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function SetPasswordForm({ token, forced = false }: { token?: string; forced?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “submit” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(forced ? "/api/auth/change-password" : "/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forced ? { password } : { token, password }),
      });
      const payload = await response.json() as { redirectTo?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "ตั้งรหัสผ่านไม่สำเร็จ");
      router.replace(payload.redirectTo ?? "/login");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ตั้งรหัสผ่านไม่สำเร็จ"); }
    finally { setLoading(false); }
  };
  return <form className="grid gap-5" onSubmit={submit}>
    <label>รหัสผ่านใหม่ <input autoComplete="new-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
    <label>ยืนยันรหัสผ่าน <input autoComplete="new-password" minLength={12} onChange={(event) => setConfirm(event.target.value)} required type="password" value={confirm} /></label>
    <p className="text-sm text-[#62646c]">อย่างน้อย 12 ตัวอักษร</p>
    {error ? <p className="form-alert error" role="alert">{error}</p> : null}
    <button className="primary-button" disabled={loading} type="submit">{loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}</button>
  </form>;
}
