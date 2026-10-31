"use client";
// ฟอร์มบัญชีรับค่าแพ็กเกจของแพลตฟอร์ม ต้องเก็บค่าที่พิมพ์และสถานะการบันทึกไว้ในเบราว์เซอร์

import { useState } from "react";
import { SettingsCard, TextField } from "@/components/dorm/pages/settings-fields";
import { formatClientError, readApiPayload } from "@/lib/client/api-error";

type PlatformPaymentSettings = {
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  promptPayId: string | null;
};

// ค่าในฟอร์มเป็นสตริงทั้งหมด ช่องว่างส่งเป็น null ให้เซิร์ฟเวอร์ล้างค่า
function toDraft(settings: PlatformPaymentSettings) {
  return {
    bankName: settings.bankName ?? "",
    bankAccountNumber: settings.bankAccountNumber ?? "",
    bankAccountName: settings.bankAccountName ?? "",
    promptPayId: settings.promptPayId ?? "",
  };
}

export function PlatformPaymentSettingsForm({ initialSettings }: Readonly<{ initialSettings: PlatformPaymentSettings }>) {
  const [draft, setDraft] = useState(() => toDraft(initialSettings));
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const update = (key: keyof typeof draft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));

  async function save() {
    // กันกดบันทึกซ้ำระหว่างรอคำตอบ
    if (isSaving) return;
    setIsSaving(true); setStatus(null);
    try {
      const response = await fetch("/api/v1/super-admin/payment-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() || null]))),
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

  return <section className="super-admin-account-page grid gap-4 py-6">
    <SettingsCard
      description="ข้อมูลนี้แสดงในหน้าต่ออายุแพ็กเกจของเจ้าของหอ คู่กับ QR พร้อมเพย์ตรงยอดของแต่ละคำสั่งซื้อ"
      isSaving={isSaving}
      onSave={() => void save()}
      title="บัญชีรับค่าแพ็กเกจ"
    >
      <div className="settings-form-grid three">
        <TextField label="ธนาคาร" onChange={update("bankName")} value={draft.bankName} />
        <TextField label="เลขที่บัญชี" onChange={update("bankAccountNumber")} value={draft.bankAccountNumber} />
        <TextField label="ชื่อบัญชี" onChange={update("bankAccountName")} value={draft.bankAccountName} />
        <TextField label="เลขพร้อมเพย์" onChange={update("promptPayId")} value={draft.promptPayId} />
      </div>
      <p className="mt-3 text-sm text-[#73757d]">กรอกธนาคาร เลขบัญชี และชื่อบัญชีให้ครบทั้งสามช่อง หรือเว้นว่างทั้งหมดถ้ารับเฉพาะพร้อมเพย์</p>
      {status ? <p className={`form-alert mt-3 ${status.tone === "error" ? "error" : ""}`} role={status.tone === "error" ? "alert" : "status"}>{status.message}</p> : null}
    </SettingsCard>
  </section>;
}
