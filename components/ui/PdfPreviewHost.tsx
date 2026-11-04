"use client";
// หน้าต่างดูตัวอย่าง PDF ของทั้งหน้า วางไว้ที่เดียวในเปลือกของหน้า ปุ่มดูตัวอย่างทุกที่มาเปิดหน้าต่างนี้
// จอใหญ่แสดง PDF ในหน้าต่างเลย มือถือหลายรุ่นแสดง PDF ในกรอบไม่ได้ จึงมีปุ่มเปิดไฟล์เต็มจอแทน

import { ExternalLink, LoaderCircle, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { closePdfPreview, getPdfPreviewState, registerPdfPreviewHost, subscribePdfPreview } from "@/lib/client/pdf-preview";

const closedState = { status: "closed" } as const;

export function PdfPreviewHost() {
  const preview = useSyncExternalStore(subscribePdfPreview, getPdfPreviewState, () => closedState);
  useEffect(() => registerPdfPreviewHost(), []);

  if (preview.status === "closed") return null;
  const close = () => closePdfPreview(preview.id);
  return <Dialog ariaDescribedBy="pdf-preview-description" ariaLabelledBy="pdf-preview-title" className="pdf-preview-modal" closeOnBackdrop onClose={close}>
    <header className="modal-header">
      <div>
        <h2 id="pdf-preview-title">{preview.title}</h2>
        <p id="pdf-preview-description">{preview.status === "loading" ? "กำลังสร้างไฟล์ PDF อาจใช้เวลาสักครู่" : "ตัวอย่างนี้ยังไม่ถูกบันทึกเป็นเอกสาร"}</p>
      </div>
      <button aria-label="ปิดตัวอย่าง" onClick={close} type="button"><X size={20} /></button>
    </header>
    {preview.status === "loading"
      ? <div aria-live="polite" className="pdf-preview-loading" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={28} /> กำลังสร้างตัวอย่าง...</div>
      : <>
        <iframe className="pdf-preview-frame" src={preview.url} title={preview.title} />
        <div className="pdf-preview-actions">
          {/* กดเองจึงเปิดแท็บใหม่ได้แน่นอน ใช้ตอนอยากดูเต็มจอ พิมพ์ หรือบันทึกไฟล์ */}
          <a className="primary-button" href={preview.url} rel="noopener" target="_blank"><ExternalLink aria-hidden="true" size={17} /> เปิดเต็มจอ</a>
          <button className="secondary-button" onClick={close} type="button">ปิด</button>
        </div>
      </>}
  </Dialog>;
}
