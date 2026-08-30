/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React account-settings ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { LoadingLabel } from "./loading-label";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "./admin-shell";

type AccountUser = {
  displayName: string;
  username: string;
  role: "SUPER_ADMIN" | "EDITOR";
  twoFactorEnabled: boolean;
};

async function updateAccount(body: object) {
  const response = await fetch("/api/admin/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) throw new Error(result.error ?? "ไม่สามารถบันทึกได้");
}

/** สร้างส่วนหน้าจอ AccountSettings; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AccountSettings({ initialUser }: { initialUser: AccountUser }) {
  const router = useRouter();
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await updateAccount({
        type: "profile",
        displayName: String(data.get("displayName")),
      });
      setProfileMessage("บันทึกชื่อที่แสดงแล้ว");
      router.refresh();
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "ไม่สามารถบันทึกได้",
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await updateAccount({
        type: "password",
        currentPassword: String(data.get("currentPassword")),
        password: String(data.get("password")),
        confirm: String(data.get("confirm")),
      });
      form.reset();
      setPasswordMessage("เปลี่ยนรหัสผ่านและยกเลิก session อื่นแล้ว");
    } catch (error) {
      setPasswordMessage(
        error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนรหัสผ่านได้",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="ตั้งค่าบัญชี"
        description="จัดการข้อมูลและความปลอดภัยของบัญชีที่กำลังใช้งาน"
      />
      <div className="grid-2 account-settings-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>
              <span className="cluster">
                <UserRound size={18} /> ข้อมูลบัญชี
              </span>
            </h2>
          </div>
          <form className="card-body form-stack" onSubmit={saveProfile}>
            <div className="form-group">
              <label htmlFor="account-display-name">ชื่อที่แสดง</label>
              <input
                id="account-display-name"
                className="field"
                name="displayName"
                defaultValue={initialUser.displayName}
                maxLength={160}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="account-username">ชื่อผู้ใช้</label>
              <input
                id="account-username"
                className="field"
                value={initialUser.username}
                readOnly
                disabled
              />
            </div>
            <div className="form-group">
              <label>บทบาทและ 2FA</label>
              <div className="cluster">
                <span className="tag">
                  {initialUser.role === "SUPER_ADMIN"
                    ? "Super Admin"
                    : "Editor"}
                </span>
                <span className="status">
                  <ShieldCheck size={14} />{" "}
                  {initialUser.twoFactorEnabled
                    ? "เปิดใช้งาน 2FA"
                    : "ยังไม่ได้ตั้งค่า 2FA"}
                </span>
              </div>
            </div>
            {profileMessage && (
              <p className="muted" role="status">
                {profileMessage}
              </p>
            )}
            <button
              className="btn btn-dark"
              disabled={profileBusy}
              aria-busy={profileBusy}
            >
              <LoadingLabel busy={profileBusy} busyText="กำลังบันทึก…">
                บันทึกข้อมูล
              </LoadingLabel>
            </button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>
              <span className="cluster">
                <KeyRound size={18} /> เปลี่ยนรหัสผ่าน
              </span>
            </h2>
          </div>
          <form className="card-body form-stack" onSubmit={changePassword}>
            <div className="form-group">
              <label htmlFor="current-password">รหัสผ่านปัจจุบัน</label>
              <input
                id="current-password"
                className="field"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-password">รหัสผ่านใหม่</label>
              <input
                id="new-password"
                className="field"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
              <span className="muted">
                อย่างน้อย 12 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และสัญลักษณ์
              </span>
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label>
              <input
                id="confirm-password"
                className="field"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </div>
            {passwordMessage && (
              <p className="muted" role="status">
                {passwordMessage}
              </p>
            )}
            <button
              className="btn btn-dark"
              disabled={passwordBusy}
              aria-busy={passwordBusy}
            >
              <LoadingLabel busy={passwordBusy} busyText="กำลังเปลี่ยน…">
                เปลี่ยนรหัสผ่าน
              </LoadingLabel>
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
