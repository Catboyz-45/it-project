"use client";
// ตัวช่วยจัดหน้าที่หน้าตั้งค่าใช้ซ้ำ กรอบหมวด ช่องกรอก และรายการที่แก้ไขได้
// แยกไฟล์เพื่อให้ทั้งหน้าตั้งค่าหอและส่วนบัญชีเรียกใช้ได้โดยไม่ import วนกัน

import type { ReactNode } from "react";

export function SettingsCard({
  actions,
  children,
  description,
  isSaving = false,
  onSave,
  title,
}: Readonly<{
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  isSaving?: boolean;
  onSave?: () => void;
  title: string;
}>) {
  return (
    <article className="settings-card settings-section">
      <div className="settings-card-body">
        <div className="settings-card-head">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {children}
      </div>
      <div className="settings-card-actions">
        {actions ?? <button className="settings-update-button" disabled={isSaving} onClick={onSave} type="button">{isSaving ? "กำลังบันทึก..." : "บันทึก"}</button>}
      </div>
    </article>
  );
}

// ช่องรหัสผ่านพร้อมปุ่มสลับดูหรือซ่อน
export function PasswordField({ label, onChange, value }: Readonly<{ label: string; onChange: (value: string) => void; value: string }>) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input autoComplete={label === "รหัสผ่านปัจจุบัน" ? "current-password" : "new-password"} maxLength={128} minLength={12} onChange={(event) => onChange(event.target.value)} type="password" value={value} />
    </label>
  );
}

export function TextField({
  label,
  onChange,
  suffix,
  type = "text",
  value,
}: Readonly<{
  label: string;
  onChange: (value: string) => void;
  suffix?: string;
  type?: "number" | "text";
  value: string;
}>) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <div className="settings-input-wrap">
        <input onChange={(event) => onChange(event.target.value)} type={type} value={value} />
        {suffix ? <em>{suffix}</em> : null}
      </div>
    </label>
  );
}

export function TextAreaField({ label, onChange, value }: Readonly<{ label: string; onChange: (value: string) => void; value: string }>) {
  return (
    <label className="settings-field full">
      <span>{label}</span>
      <textarea onChange={(event) => onChange(event.target.value)} rows={3} value={value} />
    </label>
  );
}

// รายการที่เพิ่มและลบรายการย่อยได้ ใช้กับเฟอร์นิเจอร์และรายการคล้ายกัน
export function EditableList({
  emptyText,
  items,
  onEdit,
  onRemove,
}: Readonly<{
  emptyText: string;
  items: Array<{ detail: string; id: string; title: string }>;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}>) {
  if (items.length === 0) return <p className="settings-empty-list">{emptyText}</p>;
  return (
    <div className="settings-editable-list">
      {items.map((item) => (
        <article key={item.id}>
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          <div><button onClick={() => onEdit(item.id)} type="button">แก้ไข</button><button className="danger" onClick={() => onRemove(item.id)} type="button">ลบ</button></div>
        </article>
      ))}
    </div>
  );
}
