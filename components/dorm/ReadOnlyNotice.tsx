
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

// ป้ายบอกว่าบทบาทนี้ดูได้อย่างเดียว บอกไว้ก่อนดีกว่าปล่อยให้กดแล้วเจอปฏิเสธทีหลัง
export function ReadOnlyNotice({
  children = "ดูข้อมูลเดิมได้ แต่ไม่สามารถเพิ่ม แก้ไข หรือดำเนินการรายการนี้ได้",
  className = "",
  // compact = ป้ายเล็กวางข้างปุ่ม ปกติเป็นกล่องเต็มความกว้างบนหัวหน้า
  compact = false,
  title = "โหมดอ่านอย่างเดียว",
}: Readonly<{
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  title?: string;
}>) {
  // ประกาศแบบ polite ให้โปรแกรมอ่านหน้าจออ่านตอนว่าง ไม่ขัดจังหวะสิ่งที่กำลังอ่านอยู่
  // แบบ compact ใช้ output ได้เพราะข้างในเป็นข้อความล้วน ส่วนกล่องเต็มยังเป็น div
  // เพราะ output รับได้แค่เนื้อหาระดับข้อความ แต่ข้างในมีทั้ง strong และ p
  if (compact) {
    return <output className={`read-only-control-note ${className}`.trim()}><LockKeyhole aria-hidden="true" size={15} />{title}</output>;
  }

  return <div className={`read-only-notice ${className}`.trim()} role="status">
    <LockKeyhole aria-hidden="true" size={18} />
    <div><strong>{title}</strong><p>{children}</p></div>
  </div>;
}
