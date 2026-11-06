// ค่าที่แสดงอย่างเดียวในฟอร์ม เช่น ขอบเขตของบิล หรือมิเตอร์ล่าสุดที่แก้ตรงนี้ไม่ได้
// เดิมเป็นกล่องที่ป้ายอยู่ข้างในและค่าเป็นตัวหนังสือใหญ่ วางข้างช่องกรอกแล้วสูงไม่เท่ากันและดูเหมือนตัวเลขสรุป
// ตอนนี้ป้ายอยู่ข้างบนเหมือนช่องกรอก ค่าอยู่ในกล่องสูงเท่าช่องกรอก แต่พื้นเทา บอกว่าแก้ตรงนี้ไม่ได้

import { useId, type ReactNode } from "react";

export function ReadOnlyField({ children, className = "", hint, label }: Readonly<{
  children: ReactNode;
  className?: string;
  // บอกว่าไปแก้ได้ที่ไหน หรือทำไมแก้ตรงนี้ไม่ได้
  hint?: string;
  label: string;
}>) {
  const labelId = useId();
  return <div aria-labelledby={labelId} className={`field-stack readonly-field ${className}`.trim()} role="group">
    <span id={labelId}>{label}</span>
    <div className="readonly-field-value">{children}</div>
    {hint ? <small className="readonly-field-hint">{hint}</small> : null}
  </div>;
}
