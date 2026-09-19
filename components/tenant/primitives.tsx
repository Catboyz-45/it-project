// ชิ้นส่วนหน้าตาล้วน ๆ ไม่มี hook ไม่มี event จึงไม่ต้องประกาศ "use client"
// แยกออกจาก TenantPortal เพื่อให้ Server Component เรียกใช้ได้ด้วย
// ของพวกนี้เคยอยู่ในไฟล์ที่ประกาศ use client จึงถูกส่งไปรันบนเบราว์เซอร์ทั้งที่ไม่จำเป็น
import type { ReactNode } from "react";
import { formatStatus } from "@/lib/ui-labels";

export function Panel({ children, title }: { children: ReactNode; title: string }) {
  return <section className="panel"><h2 className="mb-4 text-base font-semibold">{title}</h2>{children}</section>;
}

export function InfoCard({ label, value }: { label: string; value: string }) {
  return <article className="panel"><small>{label}</small><strong className="mt-2 block text-2xl">{value}</strong></article>;
}

export function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-[#62646c]">{label}</dt><dd className="font-bold">{value}</dd></div>;
}

export function Empty({ description, icon, text }: { description?: string; icon: ReactNode; text: string }) {
  return <div className="empty-state">{icon}<strong>{text}</strong>{description ? <p>{description}</p> : null}</div>;
}

export function Status({ value }: { value: string }) {
  return <span className={`badge ${["PAID", "APPROVED", "RESOLVED"].includes(value) ? "badge-paid" : ""}`}>{formatStatus(value)}</span>;
}
