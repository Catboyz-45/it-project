"use client";
// หน้าช่วยเหลือของผู้เช่า เป็นคำถามที่พบบ่อยแบบกดกางทีละข้อ เนื้อหาอยู่ใน lib/help/tenant-faq.ts
// ลิงก์จากหน้าอื่นที่ลงท้ายด้วย #id จะเปิดข้อนั้นไว้ให้และเลื่อนไปหา

import Link from "next/link";
import { ArrowRight, ChevronDown, CircleHelp, Lock, Package, ReceiptText, Search, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { AskDormButton } from "@/components/tenant/AskDormButton";
import { tenantFaqCategories, tenantFaqs, type TenantFaqCategory } from "@/lib/help/tenant-faq";
import { tenantPagePath } from "@/lib/navigation-routes";

const categoryIcon = { bills: ReceiptText, tickets: Wrench, parcels: Package, account: Lock } as const;

export function TenantHelp({ canAskDorm }: Readonly<{ canAskDorm: boolean }>) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TenantFaqCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // อ่าน #id ตอนเปิดหน้าและตอนกดลิงก์ในหน้าเดิม แล้วกางข้อนั้นให้
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!tenantFaqs.some((faq) => faq.id === id)) return;
      setCategory("all");
      setQuery("");
      setOpenId(id);
      window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
  const shown = tenantFaqs.filter((faq) =>
    (category === "all" || faq.category === category)
    && [faq.question, ...faq.answer].join(" ").toLocaleLowerCase("th-TH").includes(normalizedQuery),
  );

  return <div className="grid gap-4">
    <label className="tenant-help-search">
      <Search aria-hidden="true" size={18} />
      <input aria-label="ค้นหาคำถาม" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหา เช่น สลิป พัสดุ ลืมรหัสผ่าน" value={query} />
    </label>
    <div aria-label="หมวดคำถาม" className="flex flex-wrap gap-2" role="group">
      {[{ id: "all" as const, label: "ทั้งหมด" }, ...tenantFaqCategories].map((item) => <button
        aria-pressed={category === item.id}
        className="tenant-help-filter"
        key={item.id}
        onClick={() => setCategory(item.id)}
        type="button"
      >{item.label}</button>)}
    </div>

    {shown.length
      ? <ul aria-label="คำถามที่พบบ่อย" className="tenant-record-list">
        {shown.map((faq) => {
          const Icon = categoryIcon[faq.category];
          return <li key={faq.id}>
            <details className="tenant-help-item" id={faq.id} onToggle={(event) => {
              // จำว่าเปิดข้อไหนอยู่ ลิงก์ #id ครั้งต่อไปจะได้กางข้อใหม่ได้ถูก
              const isOpen = event.currentTarget.open;
              setOpenId((current) => isOpen ? faq.id : current === faq.id ? null : current);
            }} open={openId === faq.id}>
              <summary>
                <span aria-hidden="true" className="tenant-icon-tile" data-size="sm" data-tone="brand"><Icon size={16} /></span>
                <strong className="min-w-0 flex-1 text-[#292a30]">{faq.question}</strong>
                <ChevronDown aria-hidden="true" className="tenant-help-chevron" size={18} />
              </summary>
              <div className="tenant-help-answer">
                <ul className="grid gap-1.5">{faq.answer.map((line) => <li key={line}>{line}</li>)}</ul>
                {faq.link ? <Link className="secondary-button mt-3 inline-flex" href={tenantPagePath(faq.link.tab)}><ArrowRight aria-hidden="true" size={16} /> {faq.link.label}</Link> : null}
              </div>
            </details>
          </li>;
        })}
      </ul>
      : <div className="empty-state"><CircleHelp /><strong>ไม่พบคำถามที่ค้นหา</strong><p>ลองใช้คำอื่น หรือถามหอในแชทได้เลย</p></div>}

    {canAskDorm ? <div className="tenant-parcel-banner border-[#e4e4e7] bg-[#fff]">
      <span aria-hidden="true" className="tenant-icon-tile" data-tone="brand"><CircleHelp size={20} /></span>
      <div className="min-w-48 flex-1">
        <strong className="block text-[#292a30]">ไม่เจอคำตอบ</strong>
        <span className="block text-sm text-[#62646c]">ถามเจ้าหน้าที่หอได้โดยตรง</span>
      </div>
      <AskDormButton />
    </div> : null}
  </div>;
}
