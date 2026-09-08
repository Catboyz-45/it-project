import type { ReactNode } from "react";
import { PlatformBrand } from "@/components/ui/PlatformBrand";

/** โครงหน้าเอกสารสาธารณะ ทำให้ข้อกำหนด นโยบายข้อมูล และคุกกี้อ่านง่ายและหน้าตา一致กัน */
export function LegalDocumentPage({ children, title, version }: { children: ReactNode; title: string; version: string }) {
  return <main className="legal-document-shell">
    <article className="legal-document-card">
      <header className="legal-document-header">
        <a aria-label="กลับหน้าแรก" className="legal-brand-link" href="/"><PlatformBrand imageClassName="size-12" /></a>
        <p className="legal-eyebrow">เอกสารของ Nestly</p>
        <h1>{title}</h1>
        <p>มีผลตั้งแต่ 6 กันยายน 2569 · เวอร์ชัน {version}</p>
      </header>
      <div className="legal-document-content">{children}</div>
      <footer><a href="/legal/terms">ข้อกำหนดการใช้บริการ</a><a href="/legal/privacy">ประกาศความเป็นส่วนตัว</a><a href="/legal/cookies">นโยบายคุกกี้</a></footer>
    </article>
  </main>;
}
