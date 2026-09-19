
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

// ป้ายบอกว่าบทบาทนี้ดูได้อย่างเดียว บอกไว้ก่อนดีกว่าปล่อยให้กดแล้วเจอปฏิเสธทีหลัง
export function ReadOnlyNotice({
  children = "ดูข้อมูลเดิมได้ แต่ไม่สามารถเพิ่ม แก้ไข หรือดำเนินการรายการนี้ได้",
  className = "",
  // compact = ป้ายเล็กวางข้างปุ่ม ปกติเป็นกล่องเต็มความกว้างบนหัวหน้า
  compact = false,
  title = "โหมดอ่านอย่างเดียว",
}: {
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  title?: string;
}) {
  // role="status" ให้โปรแกรมอ่านหน้าจออ่านตอนว่าง ไม่ขัดจังหวะสิ่งที่กำลังอ่านอยู่
  if (compact) {
    return <span className={`read-only-control-note ${className}`.trim()} role="status"><LockKeyhole aria-hidden="true" size={15} />{title}</span>;
  }

  return <div className={`read-only-notice ${className}`.trim()} role="status">
    <LockKeyhole aria-hidden="true" size={18} />
    <div><strong>{title}</strong><p>{children}</p></div>
  </div>;
}
