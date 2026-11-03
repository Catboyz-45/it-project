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

// แถวข้อมูล ป้ายอยู่บน ค่าอยู่ล่าง ปุ่มอยู่ขวาในแถวเดียวกัน ตาไม่ต้องกวาดข้ามจอ
// locked ใส่กุญแจแทนปุ่ม ใช้กับข้อมูลที่ผู้ใช้แก้เองไม่ได้ เช่นอีเมล
export function AccountRow({ action, hint, label, locked = false, value }: Readonly<{
  action?: ReactNode;
  hint?: ReactNode;
  label: string;
  locked?: boolean;
  value: ReactNode;
}>) {
  return <div className="account-row">
    <div className="account-row-text">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
    {action ?? (locked ? <Lock aria-label="แก้ไขเองไม่ได้" className="account-row-lock" role="img" size={16} /> : null)}
  </div>;
}
