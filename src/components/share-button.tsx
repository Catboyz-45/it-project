/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React share-button ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/** สร้างส่วนหน้าจอ ShareButton; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title, text: title, url: window.location.href };
    if (navigator.share) { await navigator.share(data).catch(() => undefined); return; }
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };
  return <button className="btn btn-outline" type="button" onClick={share}>{copied ? <Check size={17} /> : <Share2 size={17} />}{copied ? "คัดลอกลิงก์แล้ว" : "แชร์บทความ"}</button>;
}
