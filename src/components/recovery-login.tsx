/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React recovery-login ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, KeyRound } from "lucide-react";
import { LoadingLabel } from "./loading-label";
import { setFlashMessage } from "@/lib/client-flash";

/** สร้างส่วนหน้าจอ RecoveryLogin; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function RecoveryLogin() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value.toUpperCase())) {
      setError(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    const response = await fetch("/api/auth/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value }),
    }).catch(() => null);
    if (!response?.ok) {
      setError(true);
      setSubmitting(false);
      return;
    }
    const result = (await response.json()) as { next: string };
    setFlashMessage("เข้าสู่ระบบด้วย Recovery Code สำเร็จแล้ว");
    router.replace(result.next);
    router.refresh();
  }

  return (
    <>
      <div className="icon-box">
        <KeyRound size={22} />
      </div>
      <p className="eyebrow" style={{ marginTop: 26 }}>
        ACCOUNT RECOVERY
      </p>
      <h2 className="heading">ใช้ Recovery Code</h2>
      <p className="muted">
        กรอกรหัสที่ยังไม่เคยใช้ ระบบจะยกเลิกรหัสนี้ทันทีเมื่อเข้าสู่ระบบสำเร็จ
      </p>
      {error && (
        <div className="auth-alert error" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>รหัสไม่ถูกต้อง</strong>
            <p>ตรวจรูปแบบ รหัสอาจถูกใช้แล้ว หรือหมดอายุ</p>
          </div>
        </div>
      )}
      <form className="form-stack" onSubmit={submit} aria-busy={submitting}>
        <div className="form-group">
          <label htmlFor="recovery-code">Recovery Code</label>
          <input
            id="recovery-code"
            className="field recovery-entry"
            value={value}
            disabled={submitting}
            onChange={(event) => {
              setValue(event.target.value.toUpperCase().slice(0, 14));
              setError(false);
            }}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="one-time-code"
          />
        </div>
        <button
          className="btn btn-dark"
          disabled={submitting}
          aria-busy={submitting}
        >
          <LoadingLabel busy={submitting} busyText="กำลังตรวจสอบ…">
            ตรวจสอบและเข้าสู่ระบบ <ArrowRight size={17} />
          </LoadingLabel>
        </button>
      </form>
    </>
  );
}
