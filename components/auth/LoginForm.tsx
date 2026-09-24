"use client";
// เก็บค่าที่กรอกและส่งคำขอเข้าสู่ระบบจากเบราว์เซอร์

import { SyntheticEvent, useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Crown, Eye, EyeOff, UserRound } from "lucide-react";

// บัญชีทดลองสำหรับเดโม เซิร์ฟเวอร์ส่งมาเฉพาะตอนเปิดใช้ในสภาพแวดล้อมที่ไม่ใช่ production
type DemoAccount = { label: string; email: string; password: string };

// ฟอร์มเข้าสู่ระบบ ใช้ร่วมกันทุกบทบาท เซิร์ฟเวอร์เป็นคนบอกว่าจะพาไปหน้าไหนต่อ
export function LoginForm({ demoAccounts = [] }: Readonly<{ demoAccounts?: DemoAccount[] }>) {
  const [email, setEmail] = useState(demoAccounts[0]?.email ?? "");
  const [password, setPassword] = useState(demoAccounts[0]?.password ?? "");
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // ปุ่มเริ่มต้นกดไม่ได้จนกว่า JavaScript ฝั่งเบราว์เซอร์จะทำงาน กันกดตอนฟอร์มยังส่งไม่ได้
  useEffect(() => setIsReady(true), []);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    // กันเบราว์เซอร์รีเฟรชหน้าตามพฤติกรรมฟอร์มปกติ
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
      // ให้เซิร์ฟเวอร์เป็นคนบอกปลายทาง เพราะแต่ละบทบาทไปคนละหน้า และฝั่งเบราว์เซอร์ไม่ควรรู้กฎนี้
      const result = await response.json() as { error?: string; redirectTo?: string };
      // ข้อความผิดพลาดที่ได้มาเป็นแบบกลาง ๆ โดยตั้งใจ ไม่บอกว่าอีเมลผิดหรือรหัสผิด กันเดาว่ามีบัญชีนี้อยู่ไหม
      if (!response.ok || !result.redirectTo) throw new Error(result.error || "เข้าสู่ระบบไม่สำเร็จ");
      // assign ไม่ใช่ router.push เพื่อให้โหลดหน้าใหม่ทั้งหมดพร้อมคุกกี้ session ใหม่
      window.location.assign(result.redirectTo);
    } catch (submitError) {
      // ปลดล็อกปุ่มเฉพาะตอนพลาด สำเร็จแล้วกำลังจะเปลี่ยนหน้าอยู่ ไม่ต้องปลด
      setError(submitError instanceof Error ? submitError.message : "เข้าสู่ระบบไม่สำเร็จ");
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      {/* กดการ์ดแล้วกรอกให้อัตโนมัติ ไม่ต้องพิมพ์เอง ใช้ตอนสาธิตระบบ */}
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
          {/* minLength ตรงกับเกณฑ์ของเซิร์ฟเวอร์ ส่วน autoComplete ช่วยให้ตัวจัดการรหัสผ่านทำงานถูก */}
          <input autoComplete="current-password" minLength={12} name="password" onChange={(event) => setPassword(event.target.value)} placeholder="กรอกรหัสผ่าน" required type={showPassword ? "text" : "password"} value={password} />
          {/* aria-pressed บอกโปรแกรมอ่านหน้าจอว่าปุ่มนี้เป็นสวิตช์ที่กดค้างอยู่หรือไม่ */}
          <button aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} type="button">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
        </span>
      </label>
      <a className="login-forgot-link" href="/forgot-password">ลืมรหัสผ่าน?</a>
      {error ? <p className="login-form-error" role="alert">{error}</p> : null}
      <button className="primary-button w-full" disabled={pending || !isReady} type="submit">{pending ? "กำลังเข้าสู่ระบบ..." : <>เข้าสู่ระบบ <ArrowRight size={18} /></>}</button>
    </form>
  );
}
