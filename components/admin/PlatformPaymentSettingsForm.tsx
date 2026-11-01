"use client";
// ฟอร์มบัญชีรับค่าแพ็กเกจของแพลตฟอร์ม ต้องเก็บค่าที่พิมพ์และสถานะการบันทึกไว้ในเบราว์เซอร์

import { useState } from "react";
import { Building2, QrCode } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
import { formatClientError, readApiPayload } from "@/lib/client/api-error";
import {
  bankOptions,
  formatAccountNumber,
  formatPromptPayId,
  hasBankAccount,
  type PaymentAccountDraft,
  type PaymentAccountErrors,
  toPaymentAccountPayload,
  validatePaymentAccount,
} from "@/lib/domain/payment-account-form";

type PlatformPaymentSettings = {
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  promptPayId: string | null;
};

// ค่าในฟอร์มเป็นสตริงทั้งหมด เลขจัดขีดไว้ให้อ่านง่าย ตอนส่งค่อยตัดเหลือแค่ตัวเลข
function toDraft(settings: PlatformPaymentSettings): PaymentAccountDraft {
  return {
    bankName: settings.bankName ?? "",
    bankAccountNumber: formatAccountNumber(settings.bankAccountNumber ?? ""),
    bankAccountName: settings.bankAccountName ?? "",
    promptPayId: formatPromptPayId(settings.promptPayId ?? ""),
  };
}

// แบบ Stripe: กรอกทางซ้าย ทางขวาเห็นทันทีว่าเจ้าของหอจะเห็นอะไรในหน้าต่ออายุ
export function PlatformPaymentSettingsForm({ initialSettings }: Readonly<{ initialSettings: PlatformPaymentSettings }>) {
  const [draft, setDraft] = useState(() => toDraft(initialSettings));
  // บอกผิดหลังผู้ใช้ออกจากช่องหรือกดบันทึกแล้วเท่านั้น ไม่ขึ้นแดงตั้งแต่ยังพิมพ์ไม่เสร็จ
  const [touched, setTouched] = useState<Partial<Record<keyof PaymentAccountDraft, boolean>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const errors = validatePaymentAccount(draft);
  const visibleErrors: PaymentAccountErrors = Object.fromEntries(Object.entries(errors).filter(([key]) => touched[key as keyof PaymentAccountDraft]));

  const update = (key: keyof PaymentAccountDraft) => (value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatus(null);
  };
  const touch = (key: keyof PaymentAccountDraft) => setTouched((current) => ({ ...current, [key]: true }));

  async function save() {
    // กันกดบันทึกซ้ำระหว่างรอคำตอบ
    if (isSaving) return;
    if (Object.keys(errors).length) {
      setTouched({ bankName: true, bankAccountNumber: true, bankAccountName: true, promptPayId: true });
      setStatus({ message: "แก้ช่องที่ขึ้นสีแดงก่อนบันทึก", tone: "error" });
      return;
    }
    setIsSaving(true); setStatus(null);
    try {
      const response = await fetch("/api/v1/super-admin/payment-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPaymentAccountPayload(draft)),
      });
      const payload = await readApiPayload<{ data?: PlatformPaymentSettings; error?: string; requestId?: string }>(response, "บันทึกบัญชีรับเงินไม่สำเร็จ");
      if (payload.data) setDraft(toDraft(payload.data));
      setStatus({ message: "บันทึกแล้ว เจ้าของหอจะเห็นข้อมูลนี้ในหน้าต่ออายุแพ็กเกจ", tone: "success" });
    } catch (cause) {
      setStatus({ message: formatClientError(cause, "บันทึกบัญชีรับเงินไม่สำเร็จ"), tone: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  const bankReady = hasBankAccount(draft) && !errors.bankAccountNumber;
  const promptPayReady = Boolean(draft.promptPayId.trim()) && !errors.promptPayId;

  return <section className="payment-settings">
    <div className="payment-settings-fields">
      <article className="payment-settings-card">
        <header>
          <span className="payment-settings-icon"><Building2 aria-hidden="true" size={18} /></span>
          <div><h2>บัญชีธนาคาร</h2><p>สำหรับเจ้าของหอที่โอนผ่านแอปธนาคาร</p></div>
          <SetupBadge ready={bankReady} />
        </header>
        <div className="payment-settings-field">
          <DropdownField
            label="ธนาคาร"
            onChange={(value) => { update("bankName")(value); touch("bankName"); }}
            options={[{ label: "เลือกธนาคาร", value: "" }, ...bankOptions(draft.bankName).map((name) => ({ label: name, value: name }))]}
            value={draft.bankName}
          />
          <FieldError message={visibleErrors.bankName} />
        </div>
        <Field
          error={visibleErrors.bankAccountNumber}
          hint="ตัวเลข 10-12 หลัก ระบบใส่ขีดให้เอง"
          inputMode="numeric"
          label="เลขที่บัญชี"
          onBlur={() => { touch("bankAccountNumber"); update("bankAccountNumber")(formatAccountNumber(draft.bankAccountNumber)); }}
          onChange={update("bankAccountNumber")}
          placeholder="123-4-56789-0"
          value={draft.bankAccountNumber}
        />
        <Field
          error={visibleErrors.bankAccountName}
          hint="พิมพ์ให้ตรงกับหน้าสมุดบัญชี ผู้โอนจะเห็นชื่อนี้ในแอปธนาคาร"
          label="ชื่อบัญชี"
          onBlur={() => touch("bankAccountName")}
          onChange={update("bankAccountName")}
          placeholder="บริษัท เนสต์ลี จำกัด"
          value={draft.bankAccountName}
        />
      </article>

      <article className="payment-settings-card">
        <header>
          <span className="payment-settings-icon"><QrCode aria-hidden="true" size={18} /></span>
          <div><h2>พร้อมเพย์</h2><p>ระบบสร้าง QR ตรงยอดของแต่ละคำสั่งซื้อให้เอง</p></div>
          <SetupBadge ready={promptPayReady} />
        </header>
        <Field
          error={visibleErrors.promptPayId}
          hint="เบอร์มือถือ 10 หลัก หรือเลขประจำตัวผู้เสียภาษี 13 หลัก ไม่บังคับ"
          inputMode="numeric"
          label="เลขพร้อมเพย์"
          onBlur={() => { touch("promptPayId"); update("promptPayId")(formatPromptPayId(draft.promptPayId)); }}
          onChange={update("promptPayId")}
          placeholder="081-234-5678"
          value={draft.promptPayId}
        />
      </article>
    </div>

    <aside className="payment-settings-preview" aria-label="ตัวอย่างที่เจ้าของหอเห็น">
      <p className="payment-settings-preview-title">เจ้าของหอจะเห็นแบบนี้</p>
      <PaymentPreview bankReady={bankReady} draft={draft} promptPayReady={promptPayReady} />
      {status ? <p className={`form-alert ${status.tone === "error" ? "error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.message}</p> : null}
      <button className="primary-button w-full justify-center" disabled={isSaving} onClick={() => void save()} type="button">{isSaving ? "กำลังบันทึก..." : "บันทึก"}</button>
    </aside>
  </section>;
}

function SetupBadge({ ready }: Readonly<{ ready: boolean }>) {
  return <span className={`payment-settings-badge ${ready ? "ready" : ""}`}>{ready ? "ตั้งแล้ว" : "ยังไม่ตั้ง"}</span>;
}

function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <small className="payment-settings-error" role="alert">{message}</small> : null;
}

function Field({ error, hint, inputMode, label, onBlur, onChange, placeholder, value }: Readonly<{
  error?: string;
  hint: string;
  inputMode?: "numeric";
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}>) {
  return <label className="payment-settings-field">
    <span>{label}</span>
    <input aria-invalid={Boolean(error)} inputMode={inputMode} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    {error ? <FieldError message={error} /> : <small>{hint}</small>}
  </label>;
}

// หน้าตาเดียวกับกล่องช่องทางชำระในหน้าต่ออายุแพ็กเกจของเจ้าของหอ QR จริงสร้างตามยอดของแต่ละคำสั่งซื้อ
function PaymentPreview({ bankReady, draft, promptPayReady }: Readonly<{ bankReady: boolean; draft: PaymentAccountDraft; promptPayReady: boolean }>) {
  if (!bankReady && !promptPayReady) {
    return <p className="form-alert warning">ยังไม่มีช่องทางรับเงิน เจ้าของหอจะเห็นข้อความให้ติดต่อผู้ดูแลระบบก่อนโอน</p>;
  }
  return <div className="payment-settings-preview-card">
    {promptPayReady ? <figure>
      <span className="payment-settings-qr"><QrCode aria-hidden="true" size={56} /></span>
      <figcaption>สแกนจ่ายตรงยอด</figcaption>
    </figure> : null}
    {bankReady ? <dl>
      <dt>โอนเข้าบัญชี</dt>
      <dd className="font-bold">{draft.bankName}</dd>
      <dd className="font-mono">{formatAccountNumber(draft.bankAccountNumber)}</dd>
      <dd>{draft.bankAccountName}</dd>
    </dl> : null}
    {promptPayReady && !bankReady ? <dl><dt>พร้อมเพย์</dt><dd className="font-mono">{formatPromptPayId(draft.promptPayId)}</dd></dl> : null}
  </div>;
}
