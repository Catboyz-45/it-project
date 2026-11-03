"use client";
// ชิ้นส่วนหน้าตาของหน้าบัญชี ใช้ร่วมกันทั้งเจ้าของหอ ผู้เช่า และแอดมินใหญ่ ทุกบทบาทจะได้หน้าตาเหมือนกัน
// ส่วนใหญ่เป็นแค่โครงหน้าจอ ยกเว้นการ์ดโปรไฟล์ที่อัปโหลดรูปเองได้ ทุกบทบาทใช้ API เดียวกัน

import { Camera, CheckCircle2, LoaderCircle, Lock } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import { useToast } from "@/components/ui/ToastProvider";
import { formatClientError, readApiPayload } from "@/lib/client/api-error";
import { setOwnAvatarUrl, useOwnAvatarUrl } from "@/lib/client/own-avatar";

const avatarTypes = ["image/png", "image/jpeg", "image/webp"];
const maxAvatarBytes = 5 * 1024 * 1024;

// การ์ดบนสุด บอกว่ากำลังดูบัญชีของใคร บทบาทอะไร และบัญชีใช้งานได้ปกติ
// กดที่รูปหรือปุ่มใต้อีเมลเพื่อเปลี่ยนรูปโปรไฟล์ได้เลย ไม่ต้องเปิดกล่องแยก
export function AccountProfileCard({ avatarUrl, email, name, roleLabel }: Readonly<{ avatarUrl?: string | null; email: string; name: string; roleLabel: string }>) {
  const notify = useToast();
  const imageUrl = useOwnAvatarUrl(avatarUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState("");

  const send = async (method: "POST" | "DELETE", body?: FormData) => {
    const payload = await readApiPayload<{ avatarUrl: string | null; error?: string; requestId?: string }>(
      await fetch("/api/account/avatar", { body, credentials: "same-origin", method }),
      method === "POST" ? "อัปโหลดรูปไม่สำเร็จ" : "ลบรูปไม่สำเร็จ",
    );
    setOwnAvatarUrl(payload.avatarUrl);
  };

  // ตรวจชนิดกับขนาดก่อนส่งเพื่อบอกผู้ใช้เร็ว ๆ เซิร์ฟเวอร์ตรวจจากไบต์จริงซ้ำอีกรอบ
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!avatarTypes.includes(file.type)) return setError("รองรับเฉพาะรูป PNG, JPG และ WebP");
    if (file.size > maxAvatarBytes) return setError("รูปต้องมีขนาดไม่เกิน 5 MB");
    const body = new FormData();
    body.append("file", file);
    setBusy("upload");
    try {
      await send("POST", body);
      notify({ message: "เปลี่ยนรูปโปรไฟล์แล้ว" });
    } catch (caught) {
      setError(formatClientError(caught, "อัปโหลดรูปไม่สำเร็จ"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setError("");
    setBusy("remove");
    try {
      await send("DELETE");
      notify({ message: "ลบรูปโปรไฟล์แล้ว" });
    } catch (caught) {
      setError(formatClientError(caught, "ลบรูปไม่สำเร็จ"));
    } finally {
      setBusy(null);
    }
  };

  return <section aria-label="โปรไฟล์" className="account-profile-card">
    <button aria-label={imageUrl ? "เปลี่ยนรูปโปรไฟล์" : "อัปโหลดรูปโปรไฟล์"} className="account-avatar-button" disabled={busy !== null} onClick={() => inputRef.current?.click()} type="button">
      <InitialAvatar imageUrl={imageUrl} name={name} size="lg" />
      <span aria-hidden="true" className="account-avatar-badge">{busy === "upload" ? <LoaderCircle className="animate-spin" size={13} /> : <Camera size={13} />}</span>
    </button>
    <input
      accept={avatarTypes.join(",")}
      aria-hidden="true"
      className="sr-only"
      onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }}
      ref={inputRef}
      tabIndex={-1}
      type="file"
    />
    <div className="account-profile-text">
      <div><strong>{name}</strong><span className="account-role-badge">{roleLabel}</span></div>
      <p>{email}</p>
      <div className="account-avatar-actions">
        <button disabled={busy !== null} onClick={() => inputRef.current?.click()} type="button">{busy === "upload" ? "กำลังอัปโหลด..." : imageUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}</button>
        {imageUrl ? <button disabled={busy !== null} onClick={() => void remove()} type="button">{busy === "remove" ? "กำลังลบ..." : "ลบรูป"}</button> : null}
      </div>
      {error ? <p className="account-avatar-error" role="alert">{error}</p> : null}
    </div>
    <span className="account-status-badge"><CheckCircle2 aria-hidden="true" size={15} /> บัญชีใช้งานปกติ</span>
  </section>;
}

// การ์ดหนึ่งหมวด หัวข้อกับคำอธิบายอยู่บน แถวข้อมูลเรียงลงมาคั่นด้วยเส้น
export function AccountCard({ children, description, title }: Readonly<{ children: ReactNode; description?: string; title: string }>) {
  const id = useId();
  return <section aria-labelledby={id} className="account-card">
    <header><h2 id={id}>{title}</h2>{description ? <p>{description}</p> : null}</header>
    {children}
  </section>;
}

// การ์ดที่แก้ข้อมูลได้ในตัวแบบหน้าตั้งค่าของ Cal ช่องกรอกอยู่ในการ์ด ปุ่มบันทึกอยู่ท้ายการ์ด ไม่ต้องเปิดกล่องแยก
// hint คือข้อความเล็กข้างปุ่ม เช่นเตือนว่าเปลี่ยนรหัสผ่านแล้วจะออกจากทุกอุปกรณ์
export function AccountFormCard({ action, children, description, hint, onSubmit, title }: Readonly<{
  action: ReactNode;
  children: ReactNode;
  description?: string;
  hint?: ReactNode;
  onSubmit: () => void;
  title: string;
}>) {
  const id = useId();
  return <section aria-labelledby={id} className="account-card">
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <header><h2 id={id}>{title}</h2>{description ? <p>{description}</p> : null}</header>
      <div className="account-card-body">{children}</div>
      <footer className="account-card-actions">{hint ? <small>{hint}</small> : <span />}{action}</footer>
    </form>
  </section>;
}

// ช่องที่แก้เองไม่ได้ เช่นอีเมล แสดงเป็นช่องอ่านอย่างเดียวพร้อมกุญแจ ให้รู้ว่าไม่ใช่ช่องที่ลืมเปิด
export function AccountReadOnlyField({ hint, label, value }: Readonly<{ hint: string; label: string; value: string }>) {
  const hintId = useId();
  return <div className="account-field">
    <label>
      <span>{label}</span>
      <span className="account-readonly-input"><input aria-describedby={hintId} readOnly value={value} /><Lock aria-hidden="true" size={15} /></span>
    </label>
    <small id={hintId}>{hint}</small>
  </div>;
}
