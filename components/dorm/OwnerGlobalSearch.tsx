"use client";
// รับคำพิมพ์ของผู้ใช้และยิงค้นหาจากเบราว์เซอร์

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";

// รูปแบบผลค้นหาที่ API ส่งกลับมา ใช้ type แยกแยะว่าเป็นข้อมูลชนิดไหน
type Result = { id: string; type: "room" | "tenant" | "invoice" | "lease"; title: string; subtitle: string; href: string };
// แปลงชนิดเป็นคำไทยที่แสดงเป็นป้ายเหนือชื่อผลลัพธ์
const labels = { room: "ห้อง", tenant: "ผู้เช่า", invoice: "บิล", lease: "สัญญา" };
// ช่องค้นหารวมบนแถบหัวเรื่องฝั่งเจ้าของหอ ค้นผู้เช่า ห้อง บิล และสัญญาพร้อมกัน
export function OwnerGlobalSearch({ propertyId }: { propertyId: string }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Result[]>([]); const [loading, setLoading] = useState(false);
  // ตัวค้นหานี้มีสามอย่างที่ต้องระวัง เขียนรวมไว้ในบรรทัดเดียวข้างล่าง
  // หนึ่ง ต้องพิมพ์อย่างน้อย 2 ตัวก่อนถึงจะค้น ไม่งั้นพิมพ์ตัวเดียวได้ผลมาทั้งหอ
  // สอง หน่วง 250 มิลลิวินาทีหลังหยุดพิมพ์ จะได้ไม่ยิงทุกครั้งที่กดแป้น
  // สาม AbortController ยกเลิกคำขอเก่าเมื่อพิมพ์ต่อ กันผลเก่ามาถึงทีหลังแล้วทับผลใหม่
  // ส่วน catch ที่ว่างไว้เป็นเรื่องปกติ เพราะการยกเลิกเองไม่ใช่ข้อผิดพลาด แต่ต้องดักไว้ไม่งั้นเป็น unhandled rejection
  useEffect(() => { if (query.trim().length < 2) { setResults([]); return; } const controller = new AbortController(); const timer = window.setTimeout(async () => { setLoading(true); try { const response = await fetch(`/api/v1/admin/properties/${propertyId}/search?query=${encodeURIComponent(query.trim())}`, { signal: controller.signal }); const payload = await response.json() as { data?: Result[] }; if (response.ok) setResults(payload.data ?? []); } catch { /* ยกเลิกเอง ไม่ใช่ข้อผิดพลาด */ } finally { if (!controller.signal.aborted) setLoading(false); } }, 250); return () => { window.clearTimeout(timer); controller.abort(); }; }, [propertyId, query]);
  // ผลลัพธ์ลอยทับเนื้อหาข้างล่าง และซ่อนไปเมื่อคำค้นสั้นกว่า 2 ตัว
  return <div className="relative min-w-[260px]"><label className="relative block"><span className="sr-only">ค้นหาทั้งหอ</span><Search className="absolute top-1/2 left-3 -translate-y-1/2 text-[#73757d]" size={17} /><input className="w-full pl-10 pr-12" onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาผู้เช่า ห้อง บิล สัญญา" value={query} />{query ? <IconButton className="absolute top-1/2 right-0 -translate-y-1/2" label="ล้างคำค้น" onClick={() => setQuery("")}><X size={16} /></IconButton> : null}</label>{query.trim().length >= 2 ? <div className="absolute right-0 z-50 mt-2 max-h-80 w-full min-w-[340px] overflow-auto rounded-2xl border border-white/10 bg-[#171821] p-2 text-white shadow-2xl">{loading ? <p className="p-3 text-sm text-white/50">กำลังค้นหา...</p> : results.length ? results.map((item) => <Link className="block rounded-xl p-3 hover:bg-white/10" href={item.href} key={`${item.type}-${item.id}`} onClick={() => setQuery("")}><small className="text-brand-green">{labels[item.type]}</small><strong className="block">{item.title}</strong><span className="text-sm text-white/50">{item.subtitle}</span></Link>) : <p aria-live="polite" className="rounded-xl bg-red-500/10 p-3 text-center text-sm font-bold text-red-300" role="status">ไม่พบข้อมูลที่ค้นหา</p>}</div> : null}</div>;
}
