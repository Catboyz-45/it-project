// ชิ้นส่วนหน้าตาของหน้าบัญชี ใช้ร่วมกันทั้งเจ้าของหอ ผู้เช่า และแอดมินใหญ่ ทุกบทบาทจะได้หน้าตาเหมือนกัน
// เป็นแค่โครงหน้าจอ ไม่มี state หรือการเรียก API ใช้จากคอมโพเนนต์ฝั่งเบราว์เซอร์เท่านั้น

import { CheckCircle2, Lock } from "lucide-react";
import { type ReactNode, useId } from "react";
import { InitialAvatar } from "@/components/ui/InitialAvatar";

// การ์ดบนสุด บอกว่ากำลังดูบัญชีของใคร บทบาทอะไร และบัญชีใช้งานได้ปกติ
export function AccountProfileCard({ email, name, roleLabel }: Readonly<{ email: string; name: string; roleLabel: string }>) {
  return <section aria-label="โปรไฟล์" className="account-profile-card">
    <InitialAvatar name={name} size="lg" />
    <div className="account-profile-text">
      <div><strong>{name}</strong><span className="account-role-badge">{roleLabel}</span></div>
      <p>{email}</p>
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
