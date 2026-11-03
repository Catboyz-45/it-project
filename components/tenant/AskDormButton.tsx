"use client";
// ปุ่มเล็กที่เปิดห้องแชทกับหอทันที ใช้ในหน้าที่เหลือเป็น Server Component ทั้งหน้า
import { MessageSquare } from "lucide-react";
import { tenantChatOpenEvent } from "@/lib/tenant-chat";

export function AskDormButton({ label = "ถามหอในแชท" }: Readonly<{ label?: string }>) {
  return <button className="secondary-button shrink-0" onClick={() => window.dispatchEvent(new Event(tenantChatOpenEvent))} type="button">
    <MessageSquare aria-hidden="true" size={17} /> {label}
  </button>;
}
