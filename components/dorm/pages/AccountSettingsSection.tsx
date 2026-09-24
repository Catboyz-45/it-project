"use client";
// หมวดบัญชีและความปลอดภัยของหน้าตั้งค่า แยกออกมาเพราะเป็นข้อมูลของผู้ใช้ ไม่ใช่ของหอพัก
// สถานะและฟอร์มทั้งหมดในหมวดนี้เป็นเรื่องภายในของตัวเอง หน้าตั้งค่าหอไม่ต้องรู้ด้วย

import { useState } from "react";
import { CheckCircle2, ChevronRight, LockKeyhole, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { PrivacyPreferencesPanel } from "@/components/legal/PrivacyPreferencesPanel";
import { PasswordField, TextField } from "@/components/dorm/pages/settings-fields";

type FormState = { message: string; tone: "error" | "success" } | null;
type PasswordDraft = { confirmPassword: string; currentPassword: string; newPassword: string };

export function AccountSettingsSection({
  accountEmail,
  accountName,
  onAccountNameChange,
}: Readonly<{
  accountEmail: string;
  accountName: string;
  onAccountNameChange: (name: string) => void;
}>) {
  const [profileName, setProfileName] = useState(accountName);
  const [profileState, setProfileState] = useState<FormState>(null);
  const [passwordState, setPasswordState] = useState<FormState>(null);
  const [passwords, setPasswords] = useState({ confirmPassword: "", currentPassword: "", newPassword: "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isPasswordEditorOpen, setIsPasswordEditorOpen] = useState(false);

  // บันทึกชื่อที่แสดงของบัญชี แยกจากการตั้งค่าหอ เพราะเป็นข้อมูลของผู้ใช้ไม่ใช่ของหอ
  const saveProfile = async () => {
    const displayName = profileName.trim();
    if (displayName.length < 2) {
      setProfileState({ message: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร", tone: "error" });
      return;
    }
    setIsSavingProfile(true);
    setProfileState(null);
    try {
      const saved = await saveDisplayNameRequest(displayName);
      setProfileName(saved);
      // บอกหน้าแม่ด้วย ชื่อบนแถบข้างจะได้เปลี่ยนตามทันทีโดยไม่ต้องรีเฟรช
      onAccountNameChange(saved);
      setProfileState({ message: "บันทึกข้อมูลโปรไฟล์แล้ว", tone: "success" });
      setIsProfileEditorOpen(false);
    } catch (error) {
      setProfileState({ message: error instanceof Error ? error.message : "บันทึกโปรไฟล์ไม่สำเร็จ", tone: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // เปลี่ยนรหัสผ่าน เซิร์ฟเวอร์จะยกเลิก session ทั้งหมดแล้วบังคับให้เข้าใหม่
  const changePassword = async () => {
    // เทียบสองช่องก่อน ที่เหลือให้เซิร์ฟเวอร์ตรวจ เพราะต้องเช็ครหัสเดิมด้วย
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordState({ message: "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน", tone: "error" });
      return;
    }
    setIsSavingPassword(true);
    setPasswordState(null);
    try {
      const redirectTo = await changePasswordRequest(passwords);
      setPasswordState({ message: "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่", tone: "success" });
      // assign ไม่ใช่ router.push เพื่อให้โหลดหน้าใหม่ทั้งหมด ข้อมูลเดิมจะได้ไม่ค้างในหน่วยความจำ
      window.location.assign(redirectTo);
    } catch (error) {
      // ปลดล็อกปุ่มเฉพาะตอนพลาด สำเร็จแล้วกำลังจะเปลี่ยนหน้าอยู่ ไม่ต้องปลด
      setPasswordState({ message: error instanceof Error ? error.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ", tone: "error" });
      setIsSavingPassword(false);
    }
  };

  return <div className="account-content">
    <section className="account-content-section">
      <h2>ข้อมูลบัญชี</h2>
      <div className="account-detail-row">
        <strong>ชื่อที่แสดง</strong>
        <span>{profileName}</span>
        <button onClick={() => { setProfileState(null); setIsProfileEditorOpen(true); }} type="button">แก้ไข</button>
      </div>
      <div className="account-detail-row">
        <strong>อีเมล</strong>
        <span>{accountEmail}</span>
        <small>จัดการโดยแอดมินใหญ่</small>
      </div>
      <FormMessage state={profileState} />
    </section>

    <section className="account-content-section">
      <h2>รหัสผ่านและความปลอดภัย</h2>
      <div className="account-detail-row">
        <strong>รหัสผ่าน</strong>
        <span>••••••••••••</span>
        <button onClick={() => { setPasswordState(null); setIsPasswordEditorOpen(true); }} type="button">แก้ไข</button>
      </div>
    </section>

    <section className="account-content-section">
      <h2>สถานะบัญชี</h2>
      <div className="account-standing-row">
        <span><CheckCircle2 size={22} /></span>
        <div><strong>บัญชีของคุณพร้อมใช้งาน</strong><p>บัญชีเปิดใช้งานตามปกติและยังไม่พบปัญหาด้านความปลอดภัย</p></div>
        <ChevronRight size={20} />
      </div>
    </section>

    <PrivacyPreferencesPanel />

    <ProfileEditorDialog
      isOpen={isProfileEditorOpen}
      isSaving={isSavingProfile}
      onChange={(value) => { setProfileName(value); setProfileState(null); }}
      onClose={() => setIsProfileEditorOpen(false)}
      onSubmit={saveProfile}
      state={profileState}
      value={profileName}
    />
    <PasswordEditorDialog
      isOpen={isPasswordEditorOpen}
      isSaving={isSavingPassword}
      onChange={setPasswords}
      onClose={() => setIsPasswordEditorOpen(false)}
      onSubmit={changePassword}
      passwords={passwords}
      state={passwordState}
    />
  </div>;
}

// กล่องแก้ชื่อที่แสดง เปิดจากแถวข้อมูลบัญชี
function ProfileEditorDialog({ isOpen, isSaving, onChange, onClose, onSubmit, state, value }: Readonly<{
  isOpen: boolean;
  isSaving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  state: FormState;
  value: string;
}>) {
  if (!isOpen) return null;
  return <Dialog ariaDescribedBy="profile-editor-description" ariaLabelledBy="profile-editor-title" className="confirmation-modal" onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
      <header className="modal-header"><div><h2 id="profile-editor-title">แก้ไขชื่อโปรไฟล์</h2><p id="profile-editor-description">ชื่อนี้จะแสดงในระบบและข้อความถึงผู้เช่า</p></div><IconButton label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างแก้ไขชื่อโปรไฟล์"><X /></IconButton></header>
      <TextField label="ชื่อที่แสดง" value={value} onChange={onChange} />
      <FormMessage state={state} />
      <footer className="modal-actions"><button onClick={onClose} type="button">ยกเลิก</button><button disabled={isSaving} type="submit">{isSaving ? "กำลังบันทึก..." : "บันทึก"}</button></footer>
    </form>
  </Dialog>;
}

// กล่องเปลี่ยนรหัสผ่าน หลังเปลี่ยนสำเร็จเซิร์ฟเวอร์จะยกเลิก session ทั้งหมด
function PasswordEditorDialog({ isOpen, isSaving, onChange, onClose, onSubmit, passwords, state }: Readonly<{
  isOpen: boolean;
  isSaving: boolean;
  onChange: (update: (current: PasswordDraft) => PasswordDraft) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  passwords: PasswordDraft;
  state: FormState;
}>) {
  if (!isOpen) return null;
  return <Dialog ariaDescribedBy="password-editor-description" ariaLabelledBy="password-editor-title" className="modal-md" onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
      <header className="modal-header"><div><h2 id="password-editor-title">เปลี่ยนรหัสผ่าน</h2><p id="password-editor-description">หลังเปลี่ยนแล้วระบบจะออกจากทุกอุปกรณ์</p></div><IconButton label="ปิด" onClick={onClose} tooltip="ปิดหน้าต่างเปลี่ยนรหัสผ่าน"><X /></IconButton></header>
      <div className="account-password-fields">
        <PasswordField label="รหัสผ่านปัจจุบัน" onChange={(value) => onChange((current) => ({ ...current, currentPassword: value }))} value={passwords.currentPassword} />
        <PasswordField label="รหัสผ่านใหม่" onChange={(value) => onChange((current) => ({ ...current, newPassword: value }))} value={passwords.newPassword} />
        <PasswordField label="ยืนยันรหัสผ่านใหม่" onChange={(value) => onChange((current) => ({ ...current, confirmPassword: value }))} value={passwords.confirmPassword} />
      </div>
      <p className="account-password-hint"><LockKeyhole size={17} /> อย่างน้อย 12 ตัวอักษร พร้อมตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข</p>
      <FormMessage state={state} />
      <footer className="modal-actions"><button onClick={onClose} type="button">ยกเลิก</button><button disabled={isSaving} type="submit">{isSaving ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}</button></footer>
    </form>
  </Dialog>;
}

// ข้อความผลลัพธ์ของฟอร์ม ผิดพลาดใช้ role="alert" ให้โปรแกรมอ่านหน้าจอแจ้งทันที
function FormMessage({ state }: Readonly<{ state: FormState }>) {
  if (!state) return null;
  // ผิดพลาดต้องเป็น alert ให้โปรแกรมอ่านหน้าจอแจ้งทันที ส่วนผลสำเร็จใช้ output ซึ่งมี role=status ในตัว
  if (state.tone === "error") return <p className="account-settings-message error" role="alert">{state.message}</p>;
  return <output className="account-settings-message success block">{state.message}</output>;
}

// บันทึกชื่อที่แสดง คืนชื่อที่เซิร์ฟเวอร์เก็บจริง ซึ่งอาจถูกตัดช่องว่างหัวท้ายแล้ว
async function saveDisplayNameRequest(displayName: string) {
  const response = await fetch("/api/account/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  const result = await response.json() as { error?: string; user?: { displayName: string } };
  if (!response.ok || !result.user) throw new Error(result.error ?? "บันทึกโปรไฟล์ไม่สำเร็จ");
  return result.user.displayName;
}

// เปลี่ยนรหัสผ่าน คืนที่อยู่ที่ต้องพาผู้ใช้ไปต่อหลังทุก session ถูกยกเลิก
async function changePasswordRequest({ currentPassword, newPassword }: PasswordDraft) {
  const response = await fetch("/api/account/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const result = await response.json() as { error?: string; redirectTo?: string };
  if (!response.ok) throw new Error(result.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
  return result.redirectTo ?? "/login";
}
