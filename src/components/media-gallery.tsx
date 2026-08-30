/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React media-gallery ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** สร้างส่วนหน้าจอ MediaGallery; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function MediaGallery({ title, tones }: { title: string; tones: string[] }) {
  const [active, setActive] = useState(0);
  const select = (index: number) => setActive((index + tones.length) % tones.length);
  return <div className="gallery"><div className={`media ${tones[active]} gallery-main`} role="img" aria-label={`${title} ภาพที่ ${active + 1} จาก ${tones.length}`}><button className="gallery-arrow previous" onClick={() => select(active - 1)} aria-label="ภาพก่อนหน้า"><ChevronLeft /></button><button className="gallery-arrow next" onClick={() => select(active + 1)} aria-label="ภาพถัดไป"><ChevronRight /></button></div><div className="gallery-thumbs" role="list" aria-label="เลือกรูปภาพ">{tones.map((tone, index) => <button role="listitem" key={`${tone}-${index}`} className={`media ${tone} gallery-thumb ${active === index ? "active" : ""}`} onClick={() => select(index)} aria-label={`ดูภาพที่ ${index + 1}`} aria-current={active === index ? "true" : undefined} />)}</div></div>;
}
