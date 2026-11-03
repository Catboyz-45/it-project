"use client";
// หมวดบัญชีและความปลอดภัยของหน้าตั้งค่า แยกออกมาเพราะเป็นข้อมูลของผู้ใช้ ไม่ใช่ของหอพัก
// สถานะและฟอร์มทั้งหมดในหมวดนี้เป็นเรื่องภายในของตัวเอง หน้าตั้งค่าหอไม่ต้องรู้ด้วย

import { useState } from "react";
import { AccountFormCard, AccountProfileCard, AccountReadOnlyField } from "@/components/account/AccountLayout";
import { PrivacyPreferencesPanel } from "@/components/legal/PrivacyPreferencesPanel";
import { PasswordRequirements } from "@/components/ui/PasswordRequirements";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";

type FormState = { message: string; tone: "error" | "success" } | null;
type PasswordDraft = { confirmPassword: string; currentPassword: string; newPassword: string };

const emptyPasswords: PasswordDraft = { confirmPassword: "", currentPassword: "", newPassword: "" };

export function AccountSettingsSection({
  accountAvatarUrl,
  accountEmail,
  accountName,
  onAccountNameChange,
}: Readonly<{
  accountAvatarUrl?: string | null;
  accountEmail: string;
  accountName: string;
  onAccountNameChange: (name: string) => void;
}>) {
  // ชื่อที่บันทึกแล้ว กับชื่อที่กำลังพิมพ์ในช่อง แยกกันไว้ ปุ่มอัปเดตจะกดได้เมื่อสองค่านี้ต่างกัน
  const [savedName, setSavedName] = useState(accountName);
  const [draftName, setDraftName] = useState(accountName);
  const [profileState, setProfileState] = useState<FormState>(null);
  const [passwordState, setPasswordState] = useState<FormState>(null);
  const [passwords, setPasswords] = useState<PasswordDraft>(emptyPasswords);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const isNameChanged = draftName.trim() !== savedName;
  // ช่องกรอกอยู่ในหน้าแล้ว ไม่ใช่ในกล่อง เผลอออกจากหน้าตอนพิมพ์ค้างไว้ต้องเตือนก่อน
  useUnsavedChanges((isNameChanged || Object.values(passwords).some(Boolean)) && !isSavingProfile && !isSavingPassword);

  // บันทึกชื่อที่แสดงของบัญชี แยกจากการตั้งค่าหอ เพราะเป็นข้อมูลของผู้ใช้ไม่ใช่ของหอ
  const saveProfile = async () => {
    const displayName = draftName.trim();
    if (displayName.length < 2) {
      setProfileState({ message: "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร", tone: "error" });
      return;
    }
    setIsSavingProfile(true);
    setProfileState(null);
    try {
      const saved = await saveDisplayNameRequest(displayName);
      setSavedName(saved);
      setDraftName(saved);
      // บอกหน้าแม่ด้วย ชื่อบนแถบข้างจะได้เปลี่ยนตามทันทีโดยไม่ต้องรีเฟรช
      onAccountNameChange(saved);
      setProfileState({ message: "บันทึกชื่อที่แสดงแล้ว", tone: "success" });
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

  const updatePassword = (key: keyof PasswordDraft) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswords((current) => ({ ...current, [key]: event.target.value }));
    setPasswordState(null);
  };

  return <div className="account-content">
    <AccountProfileCard avatarUrl={accountAvatarUrl} email={accountEmail} name={savedName} roleLabel="เจ้าของหอ" />

    <AccountFormCard
      action={<button className="primary-button" disabled={isSavingProfile || !isNameChanged} type="submit">{isSavingProfile ? "กำลังบันทึก..." : "อัปเดต"}</button>}
      description="ชื่อนี้แสดงในระบบและในข้อความถึงผู้เช่า"
      onSubmit={() => void saveProfile()}
      title="ข้อมูลบัญชี"
    >
      <label className="account-field"><span>ชื่อที่แสดง</span><input autoComplete="name" maxLength={120} minLength={2} onChange={(event) => { setDraftName(event.target.value); setProfileState(null); }} required value={draftName} /></label>
      <AccountReadOnlyField hint="เปลี่ยนได้โดยแอดมินใหญ่" label="อีเมลสำหรับเข้าสู่ระบบ" value={accountEmail} />
      <FormMessage state={profileState} />
    </AccountFormCard>

    <AccountFormCard
      action={<button className="primary-button" disabled={isSavingPassword || !passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword} type="submit">{isSavingPassword ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}</button>}
      description="ใช้รหัสผ่านที่เดายากและไม่ซ้ำกับเว็บอื่น"
      hint="เปลี่ยนแล้วระบบจะออกจากระบบทุกอุปกรณ์"
      onSubmit={() => void changePassword()}
      title="ความปลอดภัย"
    >
      <label className="account-field"><span>รหัสผ่านปัจจุบัน</span><input autoComplete="current-password" maxLength={256} onChange={updatePassword("currentPassword")} required type="password" value={passwords.currentPassword} /></label>
      <div className="account-field-pair">
        <label className="account-field"><span>รหัสผ่านใหม่</span><input aria-describedby="owner-password-requirements" autoComplete="new-password" maxLength={128} minLength={12} onChange={updatePassword("newPassword")} required type="password" value={passwords.newPassword} /></label>
        <label className="account-field"><span>ยืนยันรหัสผ่านใหม่</span><input autoComplete="new-password" maxLength={128} minLength={12} onChange={updatePassword("confirmPassword")} required type="password" value={passwords.confirmPassword} /></label>
      </div>
      {passwords.newPassword ? <PasswordRequirements confirmation={passwords.confirmPassword} currentPassword={passwords.currentPassword} id="owner-password-requirements" password={passwords.newPassword} /> : null}
      <FormMessage state={passwordState} />
    </AccountFormCard>

    <PrivacyPreferencesPanel />
  </div>;
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
