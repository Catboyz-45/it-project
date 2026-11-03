"use client";
// เก็บค่าที่กรอกและส่งคำขอจากเบราว์เซอร์

import { useState } from "react";
import { AccountFormCard, AccountProfileCard, AccountReadOnlyField } from "@/components/account/AccountLayout";
import { useToast } from "@/components/ui/ToastProvider";
import { formatClientError, readApiPayload } from "@/lib/client/api-error";
import { PrivacyPreferencesPanel } from "@/components/legal/PrivacyPreferencesPanel";
import { PasswordRequirements } from "@/components/ui/PasswordRequirements";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";

// ข้อความผลลัพธ์ที่แสดงในหน้า แยกจาก toast เพราะต้องค้างไว้ให้อ่านได้จนกว่าจะทำใหม่
type Message = { message: string; tone: "error" | "success" } | null;

// หน้าบัญชีแบบย่อ ใช้กับผู้เช่าและผู้ดูแลระบบ ที่ไม่มีหน้าตั้งค่าหอพักเต็มรูปแบบ
export function BasicAccountPanel({ displayName: initialDisplayName, email, roleLabel }: Readonly<{ displayName: string; email: string; roleLabel: string }>) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  // แก้บนสำเนา ชื่อจริงบนหน้าจะเปลี่ยนเมื่อบันทึกสำเร็จเท่านั้น
  const [draftName, setDraftName] = useState(initialDisplayName);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileMessage, setProfileMessage] = useState<Message>(null);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const notify = useToast();
  // ช่องกรอกอยู่ในหน้าแล้ว ไม่ใช่ในกล่อง เผลอออกจากหน้าตอนพิมพ์ค้างไว้ต้องเตือนก่อน
  useUnsavedChanges((draftName.trim() !== displayName || Object.values(passwords).some(Boolean)) && !isSavingProfile && !isSavingPassword);

  const saveProfile = async () => {
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      const payload = await readApiPayload<{ error?: string; requestId?: string; user: { displayName: string } }>(await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: draftName }),
      }), "บันทึกชื่อไม่สำเร็จ");
      setDisplayName(payload.user.displayName);
      setDraftName(payload.user.displayName);
      setProfileMessage({ message: "บันทึกชื่อที่แสดงแล้ว", tone: "success" });
      notify({ message: "บันทึกชื่อที่แสดงแล้ว" });
    } catch (error) {
      const message = formatClientError(error, "บันทึกชื่อไม่สำเร็จ");
      setProfileMessage({ message, tone: "error" });
      notify({ message, tone: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // เปลี่ยนรหัสผ่าน เซิร์ฟเวอร์จะยกเลิก session ทั้งหมดแล้วบังคับให้เข้าใหม่
  const changePassword = async () => {
    setPasswordMessage(null);
    // เทียบสองช่องก่อน ที่เหลือให้เซิร์ฟเวอร์ตรวจ เพราะต้องเช็ครหัสเดิมด้วย
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMessage({ message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน", tone: "error" });
      return;
    }
    setIsSavingPassword(true);
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
      setIsSavingPassword(false);
    }
  };

  const updatePassword = (key: keyof typeof passwords) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswords((current) => ({ ...current, [key]: event.target.value }));
    setPasswordMessage(null);
  };

  return <div className="account-content">
    <AccountProfileCard email={email} name={displayName} roleLabel={roleLabel} />

    <AccountFormCard
      action={<button className="primary-button" disabled={isSavingProfile || draftName.trim() === displayName} type="submit">{isSavingProfile ? "กำลังบันทึก..." : "อัปเดต"}</button>}
      description="ชื่อนี้แสดงในระบบและประวัติการดำเนินการ"
      onSubmit={() => void saveProfile()}
      title="ข้อมูลบัญชี"
    >
      <label className="account-field"><span>ชื่อที่แสดง</span><input autoComplete="name" maxLength={120} minLength={2} onChange={(event) => { setDraftName(event.target.value); setProfileMessage(null); }} required value={draftName} /></label>
      <AccountReadOnlyField hint="ใช้สำหรับเข้าสู่ระบบ เปลี่ยนเองไม่ได้" label="อีเมลสำหรับเข้าสู่ระบบ" value={email} />
      {profileMessage ? <ProfileMessage message={profileMessage.message} tone={profileMessage.tone} /> : null}
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
        <label className="account-field"><span>รหัสผ่านใหม่</span><input aria-describedby="basic-password-requirements" autoComplete="new-password" maxLength={128} minLength={12} onChange={updatePassword("newPassword")} required type="password" value={passwords.newPassword} /></label>
        <label className="account-field"><span>ยืนยันรหัสผ่านใหม่</span><input autoComplete="new-password" maxLength={128} minLength={12} onChange={updatePassword("confirmPassword")} required type="password" value={passwords.confirmPassword} /></label>
      </div>
      {passwords.newPassword ? <PasswordRequirements confirmation={passwords.confirmPassword} currentPassword={passwords.currentPassword} id="basic-password-requirements" password={passwords.newPassword} /> : null}
      {passwordMessage ? <ProfileMessage message={passwordMessage.message} tone={passwordMessage.tone} /> : null}
    </AccountFormCard>

    <PrivacyPreferencesPanel />
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
