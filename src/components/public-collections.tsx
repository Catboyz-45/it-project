"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { ProductCard, StoryCard } from "./content-cards";

type Product = { slug: string; name: string; brand: string; type: string; btu: string; feature: string; tone: string };
type Story = { slug: string; title: string; category: string; area?: string; date?: string; summary?: string; tone: string };

function Pagination({ current, pages, onChange }: { current: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return <nav className="public-pagination" aria-label="เปลี่ยนหน้าผลลัพธ์"><button className="btn btn-outline" disabled={current === 1} onClick={() => onChange(current - 1)}>ก่อนหน้า</button><span aria-live="polite">หน้า {current} จาก {pages}</span><button className="btn btn-outline" disabled={current === pages} onClick={() => onChange(current + 1)}>ถัดไป</button></nav>;
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return <div className="empty-state"><span className="icon-box"><SearchX size={24} /></span><h2 className="subheading">ไม่พบข้อมูลที่ตรงกับการค้นหา</h2><p className="muted">ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p><button className="btn btn-outline" onClick={onReset}>ล้างตัวกรอง</button></div>;
}

export function ProductExplorer({ items }: { items: Product[] }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [type, setType] = useState("all");
  const [btu, setBtu] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 4;
  const brands = [...new Set(items.map(item => item.brand))];
  const types = [...new Set(items.map(item => item.type))];
  const result = useMemo(() => items.filter(item => {
    const numericBtu = Number((item.btu.match(/[\d,]+/)?.[0] ?? "0").replaceAll(",", ""));
    const matchesQuery = `${item.name} ${item.brand} ${item.feature}`.toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th"));
    const matchesBtu = btu === "all" || (btu === "small" && numericBtu <= 12000) || (btu === "medium" && numericBtu > 12000 && numericBtu <= 18000) || (btu === "large" && numericBtu > 18000);
    return matchesQuery && (brand === "all" || item.brand === brand) && (type === "all" || item.type === type) && matchesBtu;
  }), [items, query, brand, type, btu]);
  const pages = Math.max(1, Math.ceil(result.length / pageSize));
  const visible = result.slice((page - 1) * pageSize, page * pageSize);
  const update = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  const reset = () => { setQuery(""); setBrand("all"); setType("all"); setBtu("all"); setPage(1); };
  return <><div className="filters"><label className="search-field"><span className="sr-only">ค้นหาสินค้า</span><Search size={18} /><input className="field" value={query} onChange={event => update(setQuery)(event.target.value)} placeholder="ค้นหาชื่อ รุ่น หรือคุณสมบัติ" /></label><select className="select filter-select" value={brand} onChange={event => update(setBrand)(event.target.value)} aria-label="กรองตามยี่ห้อ"><option value="all">ทุกยี่ห้อ</option>{brands.map(value => <option key={value}>{value}</option>)}</select><select className="select filter-select" value={type} onChange={event => update(setType)(event.target.value)} aria-label="กรองตามประเภท"><option value="all">ทุกประเภท</option>{types.map(value => <option key={value}>{value}</option>)}</select><select className="select filter-select" value={btu} onChange={event => update(setBtu)(event.target.value)} aria-label="กรองตามบีทียู"><option value="all">ทุกขนาด BTU</option><option value="small">ไม่เกิน 12,000</option><option value="medium">12,001–18,000</option><option value="large">มากกว่า 18,000</option></select></div><p className="muted" aria-live="polite">พบสินค้า {result.length} รายการ</p>{visible.length ? <div className="grid-4">{visible.map(item => <ProductCard key={item.slug} item={item} />)}</div> : <EmptyResults onReset={reset} />}<Pagination current={page} pages={pages} onChange={setPage} /></>;
}

export function StoryExplorer({ items, type }: { items: Story[]; type: "projects" | "news" }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 3;
  const categories = [...new Set(items.map(item => item.category))];
  const result = useMemo(() => items.filter(item => `${item.title} ${item.summary ?? ""} ${item.area ?? ""}`.toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th")) && (category === "all" || item.category === category)), [items, query, category]);
  const pages = Math.max(1, Math.ceil(result.length / pageSize));
  const visible = result.slice((page - 1) * pageSize, page * pageSize);
  const reset = () => { setQuery(""); setCategory("all"); setPage(1); };
  return <><div className="filters"><label className="search-field"><span className="sr-only">ค้นหา{type === "news" ? "ข่าว" : "ผลงาน"}</span><Search size={18} /><input className="field" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={type === "news" ? "ค้นหาข่าวหรือบทความ" : "ค้นหาชื่อผลงานหรือพื้นที่"} /></label><button className={`btn ${category === "all" ? "btn-dark" : "btn-outline"}`} onClick={() => { setCategory("all"); setPage(1); }}>ทั้งหมด</button>{categories.map(value => <button key={value} className={`btn ${category === value ? "btn-dark" : "btn-outline"}`} onClick={() => { setCategory(value); setPage(1); }}>{value}</button>)}</div><p className="muted" aria-live="polite">พบ {result.length} รายการ</p>{visible.length ? <div className="grid-3">{visible.map(item => <StoryCard key={item.slug} item={item} type={type} />)}</div> : <EmptyResults onReset={reset} />}<Pagination current={page} pages={pages} onChange={setPage} /></>;
}
