/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Read Only Notice” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Read Only Notice” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children = "ดูข้อมูลเดิมได้ แต่ไม่สามารถเพิ่ม แก้ไข หรือดำ: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ReadOnlyNotice({
  children = "ดูข้อมูลเดิมได้ แต่ไม่สามารถเพิ่ม แก้ไข หรือดำเนินการรายการนี้ได้",
  className = "",
  compact = false,
  title = "โหมดอ่านอย่างเดียว",
}: {
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  title?: string;
}) {
  if (compact) {
    return <span className={`read-only-control-note ${className}`.trim()} role="status"><LockKeyhole aria-hidden="true" size={15} />{title}</span>;
  }

  return <div className={`read-only-notice ${className}`.trim()} role="status">
    <LockKeyhole aria-hidden="true" size={18} />
    <div><strong>{title}</strong><p>{children}</p></div>
  </div>;
}
