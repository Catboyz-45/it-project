"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Owner Global Search” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Result” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Result = { id: string; type: "room" | "tenant" | "invoice" | "lease"; title: string; subtitle: string; href: string };
const labels = { room: "ห้อง", tenant: "ผู้เช่า", invoice: "บิล", lease: "สัญญา" };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Owner Global Search” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { propertyId }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function OwnerGlobalSearch({ propertyId }: { propertyId: string }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Result[]>([]); const [loading, setLoading] = useState(false);
  useEffect(() => { if (query.trim().length < 2) { setResults([]); return; } const controller = new AbortController();   /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “timer” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
const timer = window.setTimeout(async () => { setLoading(true); try { const response = await fetch(`/api/v1/admin/properties/${propertyId}/search?query=${encodeURIComponent(query.trim())}`, { signal: controller.signal }); const payload = await response.json() as { data?: Result[] }; if (response.ok) setResults(payload.data ?? []); } catch { /* ผู้ใช้พิมพ์ต่อจึงยกเลิกคำขอเดิม หรือค้นหาไม่สำเร็จ — ไม่ต้องแจ้งเตือน แต่ต้อง catch ไม่งั้นเป็น unhandled rejection */ } finally { if (!controller.signal.aborted) setLoading(false); } }, 250); return () => { window.clearTimeout(timer); controller.abort(); }; }, [propertyId, query]);
  return <div className="relative min-w-[260px]"><label className="relative block"><span className="sr-only">ค้นหาทั้งหอ</span><Search className="absolute top-1/2 left-3 -translate-y-1/2 text-[#73757d]" size={17} /><input className="w-full pl-10 pr-12" onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาผู้เช่า ห้อง บิล สัญญา" value={query} />{query ? <IconButton className="absolute top-1/2 right-0 -translate-y-1/2" label="ล้างคำค้น" onClick={() => setQuery("")}><X size={16} /></IconButton> : null}</label>{query.trim().length >= 2 ? <div className="absolute right-0 z-50 mt-2 max-h-80 w-full min-w-[340px] overflow-auto rounded-2xl border border-white/10 bg-[#171821] p-2 text-white shadow-2xl">{loading ? <p className="p-3 text-sm text-white/50">กำลังค้นหา...</p> : results.length ? results.map((item) => <Link className="block rounded-xl p-3 hover:bg-white/10" href={item.href} key={`${item.type}-${item.id}`} onClick={() => setQuery("")}><small className="text-brand-green">{labels[item.type]}</small><strong className="block">{item.title}</strong><span className="text-sm text-white/50">{item.subtitle}</span></Link>) : <p aria-live="polite" className="rounded-xl bg-red-500/10 p-3 text-center text-sm font-bold text-red-300" role="status">ไม่พบข้อมูลที่ค้นหา</p>}</div> : null}</div>;
}
