"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Login Form” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Crown, Eye, EyeOff, UserRound } from "lucide-react";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Demo Account” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type DemoAccount = { label: string; email: string; password: string };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Login Form” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { demoAccounts = [] }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function LoginForm({ demoAccounts = [] }: { demoAccounts?: DemoAccount[] }) {
  const [email, setEmail] = useState(demoAccounts[0]?.email ?? "");
  const [password, setPassword] = useState(demoAccounts[0]?.password ?? "");
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => setIsReady(true), []);

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
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok || !result.redirectTo) throw new Error(result.error || "เข้าสู่ระบบไม่สำเร็จ");
      window.location.assign(result.redirectTo);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "เข้าสู่ระบบไม่สำเร็จ");
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      {demoAccounts.length > 0 ? <section aria-label="บัญชีทดลอง" className="login-demo-accounts">
        <h3>บัญชีทดลอง</h3>
        {demoAccounts.map((account, index) => <article className={email === account.email ? "selected" : ""} key={account.email}>
          <div className="mb-3 flex items-center justify-between">
            <strong className="flex items-center gap-2">{index === 0 ? <Crown className="text-brand-green" size={18} /> : <UserRound className="text-brand-cyan" size={18} />}{account.label}</strong>
            {email === account.email ? <Check className="text-brand-green" size={18} /> : null}
          </div>
          <button className="group grid w-full gap-1 text-left" onClick={() => { setEmail(account.email); setPassword(account.password); setError(""); }} type="button">
            <span><code>{account.email}</code><Copy size={14} /></span>
            <span><code>{account.password}</code><Copy size={14} /></span>
          </button>
        </article>)}
      </section> : null}
      <label>อีเมล<input autoComplete="username" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required type="email" value={email} /></label>
      <label>รหัสผ่าน
        <span className="login-password-field">
          <input autoComplete="current-password" minLength={12} name="password" onChange={(event) => setPassword(event.target.value)} placeholder="กรอกรหัสผ่าน" required type={showPassword ? "text" : "password"} value={password} />
          <button aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} type="button">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
        </span>
      </label>
      <a className="login-forgot-link" href="/forgot-password">ลืมรหัสผ่าน?</a>
      {error ? <p className="login-form-error" role="alert">{error}</p> : null}
      <button className="primary-button w-full" disabled={pending || !isReady} type="submit">{pending ? "กำลังเข้าสู่ระบบ..." : <>เข้าสู่ระบบ <ArrowRight size={18} /></>}</button>
    </form>
  );
}
