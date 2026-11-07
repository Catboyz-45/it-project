"use client";
// รับคำพิมพ์ของผู้ใช้และยิงค้นหาจากเบราว์เซอร์

import Link from "next/link";
import { Search } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

// รูปแบบผลค้นหาที่ API ส่งกลับมา ใช้ type แยกแยะว่าเป็นข้อมูลชนิดไหน
type Result = { id: string; type: "room" | "tenant" | "invoice" | "lease"; title: string; subtitle: string; href: string };
// แปลงชนิดเป็นคำไทยที่แสดงเป็นป้ายเหนือชื่อผลลัพธ์
const labels = { room: "ห้อง", tenant: "ผู้เช่า", invoice: "บิล", lease: "สัญญา" };

// ค้นหาทั้งหอ ค้นผู้เช่า ห้อง บิล และสัญญาพร้อมกัน
// บนหัวหน้าเป็นแค่ปุ่ม "ค้นหา" กดแล้วเปิดกล่องค้นหา เดิมเป็นช่องพิมพ์ยาวหน้าตาเหมือนช่องกรองตารางของแต่ละหน้า
// หน้าที่มีทั้งสองช่องผู้ใช้เลยไม่รู้ว่าควรพิมพ์ช่องไหน กด Ctrl+K หรือ ⌘K ก็เปิดได้ แต่ไม่เขียนไว้บนปุ่ม เพราะไม่ใช่ทุกคนใช้แมค
export function OwnerGlobalSearch({ propertyId }: Readonly<{ propertyId: string }>) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openOnShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", openOnShortcut);
    return () => window.removeEventListener("keydown", openOnShortcut);
  }, []);

  return <>
    <button aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" aria-label="ค้นหาทั้งหอ" className="global-search-button" onClick={() => setIsOpen(true)} type="button">
      <Search aria-hidden="true" size={16} strokeWidth={1.75} />
      <span>ค้นหา</span>
    </button>
    {isOpen ? <GlobalSearchDialog onClose={() => setIsOpen(false)} propertyId={propertyId} /> : null}
  </>;
}

function GlobalSearchDialog({ onClose, propertyId }: Readonly<{ onClose: () => void; propertyId: string }>) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Result[]>([]); const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const hasQuery = query.trim().length >= 2;
  // ตัวค้นหานี้มีสามอย่างที่ต้องระวัง เขียนรวมไว้ในบรรทัดเดียวข้างล่าง
  // หนึ่ง ต้องพิมพ์อย่างน้อย 2 ตัวก่อนถึงจะค้น ไม่งั้นพิมพ์ตัวเดียวได้ผลมาทั้งหอ
  // สอง หน่วง 250 มิลลิวินาทีหลังหยุดพิมพ์ จะได้ไม่ยิงทุกครั้งที่กดแป้น
  // สาม AbortController ยกเลิกคำขอเก่าเมื่อพิมพ์ต่อ กันผลเก่ามาถึงทีหลังแล้วทับผลใหม่
  // ส่วน catch ที่ว่างไว้เป็นเรื่องปกติ เพราะการยกเลิกเองไม่ใช่ข้อผิดพลาด แต่ต้องดักไว้ไม่งั้นเป็น unhandled rejection
  useEffect(() => { if (query.trim().length < 2) { setResults([]); return; } const controller = new AbortController(); const timer = window.setTimeout(async () => { setLoading(true); try { const response = await fetch(`/api/v1/admin/properties/${propertyId}/search?query=${encodeURIComponent(query.trim())}`, { signal: controller.signal }); const payload = await response.json() as { data?: Result[] }; if (response.ok) setResults(payload.data ?? []); } catch { /* ยกเลิกเอง ไม่ใช่ข้อผิดพลาด */ } finally { if (!controller.signal.aborted) setLoading(false); } }, 250); return () => { window.clearTimeout(timer); controller.abort(); }; }, [propertyId, query]);

  // ลูกศรลงจากช่องพิมพ์ไปผลแรก ลูกศรขึ้นลงเลื่อนระหว่างผล Enter ในช่องพิมพ์เปิดผลแรกเลย
  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    if (links.length === 0) return;
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "ArrowDown") { event.preventDefault(); links[Math.min(index + 1, links.length - 1)]?.focus(); }
    if (event.key === "ArrowUp" && index >= 0) { event.preventDefault(); (index === 0 ? listRef.current?.closest(".search-dialog")?.querySelector("input") : links[index - 1])?.focus(); }
    if (event.key === "Enter" && index < 0) { event.preventDefault(); links[0].click(); }
  };

  return <Dialog ariaDescribedBy="global-search-hint" ariaLabel="ค้นหาทั้งหอ" backdropClassName="search-backdrop" className="search-dialog" closeOnBackdrop onClose={onClose}>
    <label className="search-dialog-field">
      <Search aria-hidden="true" size={18} strokeWidth={1.75} />
      <span className="sr-only">คำค้นหา</span>
      <input autoComplete="off" onChange={(event) => setQuery(event.target.value)} onKeyDown={moveFocus} placeholder="ค้นหาผู้เช่า ห้อง บิล สัญญา" type="search" value={query} />
      <kbd>Esc</kbd>
    </label>
    <div className="search-dialog-results" onKeyDown={moveFocus} ref={listRef}>
      {!hasQuery ? <p className="search-dialog-hint" id="global-search-hint">พิมพ์อย่างน้อย 2 ตัวอักษร เช่น ชื่อผู้เช่า เลขห้อง หรือเลขที่บิล</p> : null}
      {hasQuery ? <SearchResults loading={loading} onSelect={onClose} results={results} /> : null}
    </div>
  </Dialog>;
}

// เนื้อในกล่องผลลัพธ์ กำลังค้น เจอ หรือไม่เจอ
function SearchResults({ loading, onSelect, results }: Readonly<{
  loading: boolean;
  onSelect: () => void;
  results: Result[];
}>) {
  if (loading) return <p className="search-dialog-hint" id="global-search-hint">กำลังค้นหา...</p>;
  if (results.length === 0) return <output className="search-dialog-hint" id="global-search-hint">ไม่พบข้อมูลที่ค้นหา</output>;
  return <>
    <p className="sr-only" id="global-search-hint">พบ {results.length} รายการ กดลูกศรลงเพื่อเลือก</p>
    {results.map((item) => <Link className="search-dialog-result" href={item.href} key={`${item.type}-${item.id}`} onClick={onSelect}>
      <span className="search-dialog-type" data-type={item.type}>{labels[item.type]}</span>
      <span className="min-w-0"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
    </Link>)}
  </>;
}
