"use client";

// แผงตั้งค่าความเป็นส่วนตัว ใช้ร่วมกันได้ทุกบทบาทเพราะทำงานกับบัญชีตัวเองเท่านั้น
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

// รูปของข้อมูลที่ API ส่งกลับมา วันที่เป็นสตริงเพราะผ่าน JSON มา
type Preferences = {
  terms: { version: string; acceptedAt: string | null };
  privacy: { version: string; acknowledgedAt: string | null };
  marketing: { version: string; enabled: boolean; updatedAt: string | null };
};

export function PrivacyPreferencesPanel() {
  // null แปลว่ายังโหลดไม่เสร็จ ใช้แยกจากกรณีโหลดแล้วแต่ยังไม่เคยตั้งค่า
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // ธงกันเขียน state หลังคอมโพเนนต์ถูกถอดออกไปแล้ว ซึ่ง React จะเตือน
    let active = true;
    void fetch("/api/legal/preferences").then(async (response) => {
      const payload = await response.json() as { preferences?: Preferences };
      if (active && response.ok && payload.preferences) setPreferences(payload.preferences);
    });
    // ปิดธงตอนถอดคอมโพเนนต์ คำตอบที่มาทีหลังจะถูกทิ้งไปเอง
    return () => { active = false; };
  }, []);

  // กดสวิตช์แล้วยิงบันทึกทันที ไม่มีปุ่มบันทึกแยก
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
      // ใช้ค่าที่เซิร์ฟเวอร์ตอบกลับมา ไม่ใช่ค่าที่เรากดไป หน้าจอจะได้ตรงกับของจริงเสมอ
      setPreferences(payload.preferences);
      setMessage(enabled ? "เปิดรับข่าวสารแล้ว" : "ถอนความยินยอมรับข่าวสารแล้ว");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ");
    } finally {
      // ปลดล็อกสวิตช์ทุกกรณี สำเร็จหรือพลาดก็ต้องกดต่อได้
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
        // ปิดสวิตช์ระหว่างที่ยังโหลดไม่เสร็จหรือกำลังบันทึก กันการกดรัว
        disabled={!preferences || pending}
        onChange={(event) => void updateMarketing(event.target.checked)}
        type="checkbox"
      />
    </label>
    {/* role="status" ทำให้โปรแกรมอ่านหน้าจอบอกผลโดยไม่ตัดจังหวะที่ผู้ใช้กำลังทำอยู่ */}
    {message ? <p className="account-settings-message" role="status">{message}</p> : null}
  </section>;
}
