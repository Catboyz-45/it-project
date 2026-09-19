import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformBrand } from "@/components/ui/PlatformBrand";

// โครงหน้าของเอกสารกฎหมายทุกฉบับ ข้อกำหนด ความเป็นส่วนตัว และคุกกี้ใช้ตัวนี้ร่วมกัน
// เนื้อหาส่งเข้ามาทาง children ส่วนหัวและท้ายหน้าเหมือนกันหมด
export function LegalDocumentPage({ children, title, version }: { children: ReactNode; title: string; version: string }) {
  return <main className="legal-document-shell">
    <article className="legal-document-card">
      <header className="legal-document-header">
        <Link aria-label="กลับหน้าแรก" className="legal-brand-link" href="/"><PlatformBrand imageClassName="size-12" /></Link>
        <p className="legal-eyebrow">เอกสารของ Nestly</p>
        <h1>{title}</h1>
        {/* โชว์เวอร์ชันให้เห็น ผู้ใช้จะได้เทียบได้ว่าที่ตัวเองกดยอมรับไว้คือฉบับนี้หรือเปล่า */}
        <p>มีผลตั้งแต่ 6 กันยายน 2569 · เวอร์ชัน {version}</p>
      </header>
      <div className="legal-document-content">{children}</div>
      {/* ลิงก์ไขว้กันทั้งสามฉบับ อ่านฉบับหนึ่งอยู่แล้วข้ามไปอีกฉบับได้เลย */}
      <footer><a href="/legal/terms">ข้อกำหนดการใช้บริการ</a><a href="/legal/privacy">ประกาศความเป็นส่วนตัว</a><a href="/legal/cookies">นโยบายคุกกี้</a></footer>
    </article>
  </main>;
}
