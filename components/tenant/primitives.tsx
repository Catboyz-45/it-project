// ชิ้นส่วนหน้าตาล้วน ๆ ไม่มี hook ไม่มี event จึงไม่ต้องประกาศ "use client"
// แยกออกจาก TenantPortal เพื่อให้ Server Component เรียกใช้ได้ด้วย
// ของพวกนี้เคยอยู่ในไฟล์ที่ประกาศ use client จึงถูกส่งไปรันบนเบราว์เซอร์ทั้งที่ไม่จำเป็น
import type { ReactNode } from "react";
import { formatInvoiceStatus, formatStatus, formatTicketStatus } from "@/lib/ui-labels";

export function Panel({ children, title }: Readonly<{ children: ReactNode; title: string }>) {
  return <section className="panel"><h2 className="mb-4 text-base font-semibold">{title}</h2>{children}</section>;
}

export function InfoCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return <article className="panel"><small>{label}</small><strong className="mt-2 block text-2xl">{value}</strong></article>;
}

export function Info({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><dt className="text-sm text-[#62646c]">{label}</dt><dd className="font-bold">{value}</dd></div>;
}

// action คือปุ่มชวนให้ทำต่อ เช่นแจ้งเรื่องแรก ไม่ใช่แค่บอกว่ายังไม่มีอะไร
export function Empty({ action, description, icon, text }: Readonly<{ action?: ReactNode; description?: string; icon: ReactNode; text: string }>) {
  return <div className="empty-state">{icon}<strong>{text}</strong>{description ? <p>{description}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</div>;
}

// สีบอกความหมายก่อนอ่าน ใช้ชุดเดียวกับฝั่งเจ้าของหอ เขียวคือเสร็จแล้ว เหลืองคือรอทำ แดงคือเลยกำหนดหรือถูกปฏิเสธ
const statusTone: Record<string, string> = {
  PAID: "badge-paid", APPROVED: "badge-paid", RESOLVED: "badge-paid", RECEIVED: "badge-paid",
  PENDING: "badge-pending", PENDING_REVIEW: "badge-pending", WAITING: "badge-pending",
  OPEN: "badge-pending", ACKNOWLEDGED: "badge-pending", IN_PROGRESS: "badge-pending",
  OVERDUE: "badge-overdue", REJECTED: "badge-overdue",
  DRAFT: "badge-draft", CANCELLED: "badge-cancelled",
};

// kind บอกว่าเป็นสถานะของอะไร บิลกับเรื่องแจ้งซ่อมมีคำเรียกเฉพาะ ต้องตรงกับที่เจ้าของหอเห็น
const labelFor = { invoice: formatInvoiceStatus, ticket: formatTicketStatus, other: formatStatus } as const;

export function Status({ kind = "other", value }: Readonly<{ kind?: keyof typeof labelFor; value: string }>) {
  return <span className={`badge ${statusTone[value] ?? ""}`}>{labelFor[kind](value)}</span>;
}
