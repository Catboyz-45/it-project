"use client";

/** แผงตั้งค่าความเป็นส่วนตัวที่ใช้ร่วมกันได้ทุก role */
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

type Preferences = {
  terms: { version: string; acceptedAt: string | null };
  privacy: { version: string; acknowledgedAt: string | null };
  marketing: { version: string; enabled: boolean; updatedAt: string | null };
};

export function PrivacyPreferencesPanel() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/legal/preferences").then(async (response) => {
      const payload = await response.json() as { preferences?: Preferences };
      if (active && response.ok && payload.preferences) setPreferences(payload.preferences);
    });
    return () => { active = false; };
  }, []);

  async function updateMarketing(enabled: boolean) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/legal/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-marketing", enabled }),
      });
      const payload = await response.json() as { error?: string; preferences?: Preferences };
      if (!response.ok || !payload.preferences) throw new Error(payload.error || "บันทึกไม่สำเร็จ");
      setPreferences(payload.preferences);
      setMessage(enabled ? "เปิดรับข่าวสารแล้ว" : "ถอนความยินยอมรับข่าวสารแล้ว");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return <section className="account-content-section privacy-preferences-panel">
    <h2>ความเป็นส่วนตัวและข้อตกลง</h2>
    <div className="legal-document-summary">
      <ShieldCheck aria-hidden="true" />
      <div><strong>เอกสารที่ใช้งานอยู่</strong><p><a href="/legal/terms">ข้อกำหนดการใช้บริการ</a> · <a href="/legal/privacy">ประกาศความเป็นส่วนตัว</a> · <a href="/legal/cookies">นโยบายคุกกี้</a></p></div>
    </div>
    <label className="legal-preference-toggle">
      <span><strong>ข่าวสารและคำแนะนำจาก Nestly</strong><small>ไม่บังคับและถอนความยินยอมได้ทุกเมื่อ</small></span>
      <input
        aria-label="รับข่าวสารและคำแนะนำจาก Nestly"
        checked={preferences?.marketing.enabled ?? false}
        disabled={!preferences || pending}
        onChange={(event) => void updateMarketing(event.target.checked)}
        type="checkbox"
      />
    </label>
    {message ? <p className="account-settings-message" role="status">{message}</p> : null}
  </section>;
}
