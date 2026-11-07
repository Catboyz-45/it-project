// การ์ดตัวเลขสรุปด้านบนของทุกหน้า ใช้แบบเดียวกันทั้งเจ้าของหอและผู้ดูแลระบบ
// ช่องที่กรองรายการได้เป็นปุ่ม กดแล้วกรองทันที ส่วนช่องที่เป็นตัวเลขเฉย ๆ ไม่ต้องส่ง onSelect
import type { ReactNode } from "react";

// จุดสีหน้าชื่อการ์ด สีเดียวกับป้ายสถานะในตาราง ดูปราดเดียวรู้ว่าการ์ดนี้เป็นสถานะอะไร
export type SummaryDot = "pending" | "urgent" | "done" | "draft" | "cancelled" | "occupied" | "available" | "maintenance";

export function SummaryCards({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
  return <div aria-label={label} className="summary-cards" role="group">{children}</div>;
}

export function SummaryCard({ badge, children, detail, dot, label, onSelect, pressed = false, unit, urgent = false, value }: Readonly<{
  badge?: string;
  // ช่องสำหรับแถบคืบหน้าหรือแถบสัดส่วน วางระหว่างตัวเลขกับบรรทัดรอง
  children?: ReactNode;
  detail?: ReactNode;
  dot?: SummaryDot;
  label: string;
  onSelect?: () => void;
  pressed?: boolean;
  unit?: string;
  urgent?: boolean;
  value: ReactNode;
}>) {
  const content = <>
    <span className="summary-card-label">
      {dot ? <span aria-hidden="true" className="summary-card-dot" data-dot={dot} /> : null}
      {label}
      {badge ? <span className="summary-card-badge">{badge}</span> : null}
    </span>
    <strong className="summary-card-value">{value}{unit ? <span>{unit}</span> : null}</strong>
    {children}
    {detail ? <small className="summary-card-detail">{detail}</small> : null}
  </>;
  if (!onSelect) return <div className="summary-card" data-urgent={urgent || undefined}>{content}</div>;
  return <button aria-pressed={pressed} className="summary-card" data-urgent={urgent || undefined} onClick={onSelect} type="button">{content}</button>;
}
