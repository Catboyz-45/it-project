// เช็คลิสต์กฎรหัสผ่าน ติ๊กถูกทีละข้อระหว่างพิมพ์ ใช้กับทุกหน้าที่ตั้งรหัสผ่านใหม่
// กฎมาจาก lib/domain/password-policy ชุดเดียวกับที่เซิร์ฟเวอร์ตรวจ ทุกข้อติ๊กถูกแล้วจึงผ่านแน่นอน

import { Check, Circle } from "lucide-react";
import { passwordRules } from "@/lib/domain/password-policy";

type Requirement = { id: string; label: string; met: boolean };

export function PasswordRequirements({
  confirmation,
  currentPassword,
  id,
  password,
}: Readonly<{
  // ส่งมาเมื่อฟอร์มมีช่องยืนยัน จะได้มีข้อ "ตรงกัน" เพิ่ม
  confirmation?: string;
  // ส่งมาเมื่อเป็นการเปลี่ยนรหัส เซิร์ฟเวอร์ไม่รับรหัสใหม่ที่ซ้ำกับรหัสเดิม
  currentPassword?: string;
  // ผูกกับช่องรหัสผ่านด้วย aria-describedby โปรแกรมอ่านหน้าจอจะได้อ่านเงื่อนไขให้ฟัง
  id: string;
  password: string;
}>) {
  const requirements: Requirement[] = passwordRules.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(password) }));
  if (currentPassword !== undefined) {
    requirements.push({ id: "different", label: "ไม่ซ้ำกับรหัสผ่านปัจจุบัน", met: password.length > 0 && password !== currentPassword });
  }
  if (confirmation !== undefined) {
    requirements.push({ id: "match", label: "รหัสผ่านทั้งสองช่องตรงกัน", met: password.length > 0 && password === confirmation });
  }

  return <ul aria-label="เงื่อนไขรหัสผ่าน" className="password-requirements" id={id}>
    {requirements.map((requirement) => <li className={requirement.met ? "met" : undefined} key={requirement.id}>
      <span aria-hidden="true" className="password-requirement-icon">
        {requirement.met ? <Check size={13} strokeWidth={3} /> : <Circle size={16} />}
      </span>
      <span>{requirement.label}</span>
      {/* ไอคอนซ่อนจากโปรแกรมอ่านหน้าจอ จึงบอกสถานะเป็นข้อความแทน */}
      <span className="sr-only">{requirement.met ? "ผ่านแล้ว" : "ยังไม่ผ่าน"}</span>
    </li>)}
  </ul>;
}
