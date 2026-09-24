"use client";
// เก็บค่าที่กรอกและส่งคำขอจากเบราว์เซอร์

import { SyntheticEvent, useState } from "react";
import { CheckCircle2, ChevronRight, LockKeyhole, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/ToastProvider";
import { formatClientError, readApiPayload } from "@/lib/client/api-error";
import { PrivacyPreferencesPanel } from "@/components/legal/PrivacyPreferencesPanel";

// ข้อความผลลัพธ์ที่แสดงในหน้า แยกจาก toast เพราะต้องค้างไว้ให้อ่านได้จนกว่าจะทำใหม่
type Message = { message: string; tone: "error" | "success" } | null;

// หน้าบัญชีแบบย่อ ใช้กับผู้เช่าและผู้ดูแลระบบ ที่ไม่มีหน้าตั้งค่าหอพักเต็มรูปแบบ
export function BasicAccountPanel({ displayName: initialDisplayName, email }: Readonly<{ displayName: string; email: string }>) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  // แก้บนสำเนา ชื่อจริงบนหน้าจะเปลี่ยนเมื่อบันทึกสำเร็จเท่านั้น
  const [draftName, setDraftName] = useState(initialDisplayName);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileMessage, setProfileMessage] = useState<Message>(null);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const notify = useToast();

  const saveProfile = async (event: SyntheticEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setProfileMessage(null);
    try {
      const payload = await readApiPayload<{ error?: string; requestId?: string; user: { displayName: string } }>(await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: draftName }),
      }), "บันทึกชื่อไม่สำเร็จ");
      setDisplayName(payload.user.displayName);
      setProfileMessage({ message: "บันทึกชื่อที่แสดงแล้ว", tone: "success" });
      setIsEditingProfile(false);
      notify({ message: "บันทึกชื่อที่แสดงแล้ว" });
    } catch (error) {
      const message = formatClientError(error, "บันทึกชื่อไม่สำเร็จ");
      setProfileMessage({ message, tone: "error" });
      notify({ message, tone: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // เปลี่ยนรหัสผ่าน เซิร์ฟเวอร์จะยกเลิก session ทั้งหมดแล้วบังคับให้เข้าใหม่
  const changePassword = async (event: SyntheticEvent) => {
    event.preventDefault();
    setPasswordMessage(null);
    // เทียบสองช่องก่อน ที่เหลือให้เซิร์ฟเวอร์ตรวจ เพราะต้องเช็ครหัสเดิมด้วย
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMessage({ message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน", tone: "error" });
      return;
    }
    setIsSaving(true);
    try {
      const payload = await readApiPayload<{ error?: string; requestId?: string; redirectTo?: string }>(await fetch("/api/account/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
      }), "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      // assign ไม่ใช่ router.push เพื่อให้โหลดหน้าใหม่ทั้งหมด ข้อมูลเดิมจะได้ไม่ค้างในหน่วยความจำ
      window.location.assign(payload.redirectTo ?? "/login");
    } catch (error) {
      const message = formatClientError(error, "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      // ปลดล็อกปุ่มเฉพาะตอนพลาด สำเร็จแล้วกำลังจะเปลี่ยนหน้าอยู่ ไม่ต้องปลด
      setPasswordMessage({ message, tone: "error" });
      notify({ message, tone: "error" });
      setIsSaving(false);
    }
  };

  return <div className="account-content">
    <section className="account-content-section">
      <h2>ข้อมูลบัญชี</h2>
      <div className="account-detail-row">
        <strong>ชื่อที่แสดง</strong><span>{displayName}</span>
        {/* ตั้งค่าสำเนาใหม่ทุกครั้งที่เปิด กันค่าที่แก้ค้างจากรอบก่อนที่กดยกเลิกไป */}
        <button onClick={() => { setDraftName(displayName); setProfileMessage(null); setIsEditingProfile(true); }} type="button">แก้ไข</button>
      </div>
      <div className="account-detail-row">
        <strong>อีเมล</strong><span>{email}</span><small>ใช้สำหรับเข้าสู่ระบบ</small>
      </div>
      {profileMessage ? <ProfileMessage message={profileMessage.message} tone={profileMessage.tone} /> : null}
    </section>

    <section className="account-content-section">
      <h2>รหัสผ่านและความปลอดภัย</h2>
      <div className="account-detail-row">
        <strong>รหัสผ่าน</strong><span>••••••••••••</span>
        <button onClick={() => { setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" }); setPasswordMessage(null); setIsEditingPassword(true); }} type="button">แก้ไข</button>
      </div>
    </section>

    <section className="account-content-section">
      <h2>สถานะบัญชี</h2>
      <div className="account-standing-row">
        <span><CheckCircle2 size={22} /></span>
        <div><strong>บัญชีของคุณพร้อมใช้งาน</strong><p>บัญชีเปิดใช้งานตามปกติและยังไม่พบปัญหาด้านความปลอดภัย</p></div>
        <ChevronRight aria-hidden="true" size={20} />
      </div>
    </section>

    <PrivacyPreferencesPanel />

    {isEditingProfile ? <Dialog ariaDescribedBy="basic-profile-description" ariaLabelledBy="basic-profile-title" className="confirmation-modal" onClose={() => { if (!isSaving) setIsEditingProfile(false); }}>
      <form className="modal-form" onSubmit={saveProfile}>
        <header className="modal-header"><div><h2 id="basic-profile-title">แก้ไขชื่อโปรไฟล์</h2><p id="basic-profile-description">ชื่อนี้จะแสดงในระบบและประวัติการดำเนินการ</p></div><IconButton disabled={isSaving} label="ปิด" onClick={() => setIsEditingProfile(false)} tooltip="ปิดหน้าต่าง"><X /></IconButton></header>
        <label><span>ชื่อที่แสดง</span><input autoComplete="name" maxLength={120} minLength={2} onChange={(event) => setDraftName(event.target.value)} required value={draftName} /></label>
        {profileMessage ? <p className={`account-settings-message ${profileMessage.tone}`} role="alert">{profileMessage.message}</p> : null}
        <footer className="modal-actions"><button disabled={isSaving} onClick={() => setIsEditingProfile(false)} type="button">ยกเลิก</button><button disabled={isSaving} type="submit">{isSaving ? "กำลังบันทึก..." : "บันทึก"}</button></footer>
      </form>
    </Dialog> : null}

    {isEditingPassword ? <Dialog ariaDescribedBy="basic-password-description" ariaLabelledBy="basic-password-title" className="modal-md" onClose={() => { if (!isSaving) setIsEditingPassword(false); }}>
      <form className="modal-form" onSubmit={changePassword}>
        <header className="modal-header"><div><h2 id="basic-password-title">เปลี่ยนรหัสผ่าน</h2><p id="basic-password-description">หลังเปลี่ยนแล้วระบบจะออกจากทุกอุปกรณ์</p></div><IconButton disabled={isSaving} label="ปิด" onClick={() => setIsEditingPassword(false)} tooltip="ปิดหน้าต่าง"><X /></IconButton></header>
        <div className="account-password-fields">
          <label><span>รหัสผ่านปัจจุบัน</span><input autoComplete="current-password" maxLength={256} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} required type="password" value={passwords.currentPassword} /></label>
          <label><span>รหัสผ่านใหม่</span><input autoComplete="new-password" maxLength={128} minLength={12} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} required type="password" value={passwords.newPassword} /></label>
          <label><span>ยืนยันรหัสผ่านใหม่</span><input autoComplete="new-password" maxLength={128} minLength={12} onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))} required type="password" value={passwords.confirmPassword} /></label>
        </div>
        <p className="account-password-hint"><LockKeyhole size={17} /> อย่างน้อย 12 ตัวอักษร พร้อมตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข</p>
        {passwordMessage ? <p className={`account-settings-message ${passwordMessage.tone}`} role="alert">{passwordMessage.message}</p> : null}
        <footer className="modal-actions"><button disabled={isSaving} onClick={() => setIsEditingPassword(false)} type="button">ยกเลิก</button><button disabled={isSaving} type="submit">{isSaving ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}</button></footer>
      </form>
    </Dialog> : null}
  </div>;
}

// ข้อผิดพลาดต้องให้โปรแกรมอ่านหน้าจอขัดจังหวะอ่านทันที จึงเป็น role="alert"
// ส่วนผลที่สำเร็จรอจังหวะว่างได้ ใช้ output ซึ่งมี role="status" ติดมาในตัว
// output เป็น inline โดยปริยาย ส่วน .account-settings-message ไม่ได้กำหนด display จึงต้องใส่ block เอง
function ProfileMessage({ message, tone }: Readonly<{ message: string; tone: string }>) {
  const className = `account-settings-message ${tone}`;
  if (tone === "error") return <p className={className} role="alert">{message}</p>;
  return <output className={`${className} block`}>{message}</output>;
}
