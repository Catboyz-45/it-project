/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React change-password-form ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { setFlashMessage } from "@/lib/client-flash";

/** สร้างส่วนหน้าจอ ChangePasswordForm; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const rules = useMemo(() => [password.length >= 12, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)], [password]);
  const strength = rules.filter(Boolean).length;
  const canSubmit = strength === rules.length && password === confirm;
  async function submit(event: FormEvent) { event.preventDefault(); if (!canSubmit) return; setSubmitting(true); const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirm }) }).catch(() => null); if (!response?.ok) { setSubmitting(false); return; } const result = await response.json() as { next: string }; setFlashMessage("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว"); router.replace(result.next); router.refresh(); }
  const labels = ["อย่างน้อย 12 ตัวอักษร", "มีตัวพิมพ์ใหญ่", "มีตัวพิมพ์เล็ก", "มีตัวเลข", "มีอักขระพิเศษ"];
  return <><div className="icon-box"><KeyRound size={22} /></div><p className="eyebrow" style={{ marginTop: 26 }}>FIRST SIGN-IN · STEP 1 OF 3</p><h2 className="heading">ตั้งรหัสผ่านใหม่</h2><p className="muted">รหัสผ่านชั่วคราวใช้ได้ครั้งเดียว กรุณาสร้างรหัสผ่านใหม่ก่อนใช้งานระบบ</p><form className="form-stack" onSubmit={submit}><div className="form-group"><label htmlFor="new-password">รหัสผ่านใหม่</label><div className="password-field"><input id="new-password" className="field" type={show ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /><button type="button" className="icon-btn" onClick={() => setShow(value => !value)} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><div className="password-meter" aria-label={`ความแข็งแรง ${strength} จาก 5`}>{rules.slice(0, 4).map((met, index) => <span key={index} className={met ? "on" : ""} />)}</div><ul className="requirement-list">{labels.map((label, index) => <li className={rules[index] ? "met" : ""} key={label}><Check size={14} /> {label}</li>)}</ul></div><div className="form-group"><label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label><input id="confirm-password" className="field" type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(confirm && confirm !== password)} />{confirm && confirm !== password && <span style={{ color: "var(--danger)", fontSize: ".76rem" }}>รหัสผ่านไม่ตรงกัน</span>}</div><button className="btn btn-dark" disabled={!canSubmit || submitting}>{submitting ? <><LoaderCircle className="spin" size={18} /> กำลังบันทึก</> : <>บันทึกและดำเนินการต่อ <ArrowRight size={17} /></>}</button></form></>;
}
