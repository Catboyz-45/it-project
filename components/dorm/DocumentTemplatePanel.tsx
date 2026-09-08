"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Document Template Panel” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Eye, Heading2, ImagePlus, Italic, List, Minus, Plus, Save, Settings2, Table2, Trash2, Underline, ZoomIn, ZoomOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";
import { DropdownField } from "@/components/dorm/DropdownField";
import { getDocumentContentCss } from "@/lib/documents/document-styles";
import type { DocumentTemplateDto, DocumentKind } from "@/lib/documents/types";
import { placeholderLabels } from "@/lib/documents/placeholders";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { RetryButton } from "@/components/ui/DataNavigation";
import { IconButton } from "@/components/ui/IconButton";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Document Template Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { editable = false, kind, propertyId, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function DocumentTemplatePanel({
  editable = false,
  kind,
  propertyId,
}: {
  editable?: boolean;
  kind: DocumentKind;
  propertyId: string;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState<DocumentTemplateDto | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Template” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadTemplate = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; template?: DocumentTemplateDto };
      if (!response.ok) throw new Error(result.error || "โหลด template ไม่สำเร็จ");
      setTemplate(result.template ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลด template ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [kind, propertyId]);

  useEffect(() => { void loadTemplate(); }, [loadTemplate]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Template” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const createTemplate = async () => {
    setIsCreating(true);
    setError("");
    try {
      const response = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json() as { error?: string; template?: DocumentTemplateDto };
      if (!response.ok || !result.template) throw new Error(result.error || "สร้างโครงเอกสารไม่สำเร็จ");
      setTemplate(result.template);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "สร้างโครงเอกสารไม่สำเร็จ");
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “preview” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const preview = async () => {
    const previewWindow = window.open("", "_blank");
    setIsPreviewing(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/preview?propertyId=${encodeURIComponent(propertyId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "สร้างตัวอย่างไม่สำเร็จ");
      }
      const url = URL.createObjectURL(await response.blob());
      if (previewWindow) previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (previewError) {
      previewWindow?.close();
      setError(previewError instanceof Error ? previewError.message : "สร้างตัวอย่างไม่สำเร็จ");
    } finally {
      setIsPreviewing(false);
    }
  };

  const title = kind === "contract" ? "โครงสัญญาหลัก" : "โครงบิลหลัก";
  return (
    <>
      <section className="panel template-panel settings-section">
        <div className="settings-section-head">
          <div><h2>{title}</h2><p>จัดการรูปแบบและตรวจสอบตัวอย่างเอกสารที่ระบบสร้าง</p></div>
          <small>{template ? `เวอร์ชัน ${template.version}` : isLoading ? "กำลังโหลด..." : "ยังไม่พร้อม"}</small>
        </div>
        {error ? <div className="template-status warn" role="alert">{error}</div> : null}
        {template ? (
          <>
            <div className="template-actions">
              <button className={editable ? "secondary-button" : "primary-button"} disabled={isPreviewing} onClick={() => void preview()} type="button"><Eye size={17} /> {isPreviewing ? "กำลังสร้างตัวอย่าง..." : "ดูตัวอย่างโครงเอกสาร"}</button>
              {editable ? <button className="primary-button" onClick={() => router.push(`/settings/documents/${kind}/edit?propertyId=${encodeURIComponent(propertyId)}`)} type="button"><Settings2 size={17} /> เปิดหน้าแก้ไขเต็ม</button> : null}
            </div>
          </>
        ) : !isLoading && !error ? (
          <div className="empty-state">
            <div>
              <strong>หอนี้ยังไม่มี{title}</strong>
              <p>{editable ? "สร้างจากโครงมาตรฐาน แล้วจึงปรับข้อความและรูปแบบให้เหมาะกับหอพัก" : "ยังไม่มีโครงเอกสารเดิมให้ดูตัวอย่าง"}</p>
              {editable ? <button className="primary-button" disabled={isCreating} onClick={() => void createTemplate()} type="button">
                <Plus size={17} /> {isCreating ? "กำลังสร้าง..." : `สร้าง${title}`}
              </button> : null}
            </div>
          </div>
        ) : !isLoading ? <RetryButton onClick={() => void loadTemplate()} /> : null}
      </section>
    </>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Template Editor” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { kind, onClose, onSaved, propertyId, template }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function TemplateEditor({ kind, onClose, onSaved, propertyId, template }: { kind: DocumentKind; onClose: () => void; onSaved: (template: DocumentTemplateDto) => void; propertyId: string; template: DocumentTemplateDto }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isPaginatingRef = useRef(false);
  const lastRangeRef = useRef<Range | null>(null);
  const pendingPageDeleteRef = useRef<(() => void) | null>(null);
  const paginationScrollRef = useRef<{
    anchor: HTMLElement | null;
    anchorTop: number | null;
    left: number;
    top: number;
    validUntil: number;
  } | null>(null);
  const [name, setName] = useState(template.name);
  const [error, setError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { confirm, confirmationDialog } = useConfirmation();
  const [isDeletePageConfirmOpen, setIsDeletePageConfirmOpen] = useState(false);
  const [tableColumns, setTableColumns] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  const [zoom, setZoom] = useState(100);
  const [isContentDirty, setIsContentDirty] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    alignment: "text-left" as "text-left" | "text-center" | "text-right",
    bold: false,
    italic: false,
    underline: false,
  });

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “paginate Editor” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const paginateEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || isPaginatingRef.current) return;
    const viewport = editor.closest<HTMLElement>(".document-editor-canvas");
    const activeScrollLock = paginationScrollRef.current && paginationScrollRef.current.validUntil > Date.now()
      ? paginationScrollRef.current
      : null;
    const previousScrollLeft = activeScrollLock?.left ?? viewport?.scrollLeft ?? 0;
    const previousScrollTop = activeScrollLock?.top ?? viewport?.scrollTop ?? 0;
    const scrollAnchor = activeScrollLock?.anchor?.isConnected ? activeScrollLock.anchor : null;
    const scrollAnchorTop = scrollAnchor ? activeScrollLock?.anchorTop ?? null : null;
    const selection = window.getSelection();
    const previousRange = selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0).cloneRange()
      : null;
    isPaginatingRef.current = true;
    editor.querySelectorAll(".editor-auto-page-break").forEach((pageBreak) => pageBreak.remove());
    const pixelsPerMillimeter = editor.getBoundingClientRect().width / 210;
    const pageHeight = 297 * pixelsPerMillimeter;
    const pagePadding = 18 * pixelsPerMillimeter;
    const pageGap = 38;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “fill Page Breaks” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const fillPageBreaks = () => {
      const pageBreaks = Array.from(editor.querySelectorAll<HTMLElement>(".page-break"));
      pageBreaks.forEach((pageBreak) => pageBreak.style.removeProperty("--editor-page-fill"));
      pageBreaks.forEach((pageBreak) => {
        const currentPage = Math.max(0, Math.floor((pageBreak.offsetTop - pagePadding) / (pageHeight + pageGap)));
        const nextPageContentTop = (currentPage + 1) * (pageHeight + pageGap) + pagePadding;
        const fillerHeight = Math.max(pageGap + pagePadding, nextPageContentTop - pageBreak.offsetTop);
        pageBreak.style.setProperty("--editor-page-fill", `${fillerHeight}px`);
      });
    };

    fillPageBreaks();
    const documentRoot = editor.querySelector<HTMLElement>(".document") ?? editor;
    for (let pass = 0; pass < 50; pass += 1) {
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: รวมขั้นตอนย่อยของ “overflowing Block” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
       * รับค่า:
       * - child: ค่า “child” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
       */
      const overflowingBlock = Array.from(documentRoot.children).find((child) => {
        if (!(child instanceof HTMLElement) || child.classList.contains("page-break")) return false;
        if (child.previousElementSibling?.classList.contains("page-break")) return false;
        const blockTop = child.offsetTop;
        const currentPage = Math.max(0, Math.floor((blockTop - pagePadding) / (pageHeight + pageGap)));
        const pageContentTop = currentPage * (pageHeight + pageGap) + pagePadding;
        const pageContentBottom = currentPage * (pageHeight + pageGap) + pageHeight - pagePadding;
        return blockTop > pageContentTop + 2 && child.offsetTop + child.offsetHeight > pageContentBottom;
      });
      if (!(overflowingBlock instanceof HTMLElement)) break;
      const automaticBreak = document.createElement("div");
      automaticBreak.className = "page-break editor-auto-page-break";
      automaticBreak.contentEditable = "false";
      overflowingBlock.before(automaticBreak);
      fillPageBreaks();
    }
    if (previousRange && editor.contains(previousRange.commonAncestorContainer)) {
      selection?.removeAllRanges();
      selection?.addRange(previousRange);
      lastRangeRef.current = previousRange.cloneRange();
    }
    if (viewport) {
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: รวมขั้นตอนย่อยของ “restore Scroll” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
       * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
       * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
       */
      const restoreScroll = () => {
        viewport.scrollLeft = previousScrollLeft;
        if (scrollAnchor && scrollAnchorTop !== null && scrollAnchor.isConnected) {
          viewport.scrollTop += scrollAnchor.getBoundingClientRect().top - scrollAnchorTop;
        } else {
          viewport.scrollTop = previousScrollTop;
        }
      };
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
      window.setTimeout(restoreScroll, 50);
      window.setTimeout(restoreScroll, 150);
      window.setTimeout(restoreScroll, 300);
      window.setTimeout(restoreScroll, 600);
    }
    isPaginatingRef.current = false;
  }, []);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “editor Html” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const editorHtml = () => {
    const editor = editorRef.current;
    if (!editor) return "";
    const clone = editor.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".editor-auto-page-break").forEach((pageBreak) => pageBreak.remove());
    clone.querySelectorAll<HTMLElement>(".page-break").forEach((pageBreak) => {
      pageBreak.style.removeProperty("--editor-page-fill");
      if (!pageBreak.getAttribute("style")) pageBreak.removeAttribute("style");
    });
    const documentRoot = clone.querySelector<HTMLElement>(".document") ?? clone;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ตอบว่าเงื่อนไข “is Empty Trailing Block” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
     * รับค่า:
     * - element: ค่า “element” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
     */
    const isEmptyTrailingBlock = (element: HTMLElement) => {
      if (element.matches("img,hr,table") || element.querySelector("img,hr,table")) return false;
      return element.textContent?.replaceAll("\u00a0", " ").trim() === "";
    };
    while (documentRoot.lastElementChild instanceof HTMLElement) {
      const lastElement = documentRoot.lastElementChild;
      if (!lastElement.classList.contains("page-break") && !isEmptyTrailingBlock(lastElement)) break;
      lastElement.remove();
    }
    return clone.innerHTML;
  };

  const isDirty = name !== template.name || isContentDirty;
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “request Close” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const requestClose = useCallback(() => {
    if (!isDirty) return onClose();
    void confirm({ title: "ทิ้งข้อมูลที่แก้ไข?", description: "เนื้อหาเอกสารที่ยังไม่บันทึกจะหายไป", confirmLabel: "ทิ้งข้อมูล" }).then((ok) => { if (ok) onClose(); });
  }, [confirm, isDirty, onClose]);
  useUnsavedChanges(isDirty);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = template.html;
    const frame = window.requestAnimationFrame(paginateEditor);
    return () => window.cancelAnimationFrame(frame);
  }, [paginateEditor, template.html]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const observer = new ResizeObserver(paginateEditor);
    observer.observe(editor);
    return () => observer.disconnect();
  }, [paginateEditor]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const observer = new MutationObserver(() => setIsContentDirty(editorHtml() !== template.html));
    observer.observe(editor, { attributes: true, characterData: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, [template.html]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “remember Selection” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    lastRangeRef.current = range.cloneRange();
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “remember Pagination Position” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const rememberPaginationPosition = () => {
    const editor = editorRef.current;
    const viewport = editor?.closest<HTMLElement>(".document-editor-canvas");
    if (!editor || !viewport) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : null;
    const selectionElement = range?.startContainer instanceof HTMLElement
      ? range.startContainer
      : range?.startContainer.parentElement ?? null;
    const anchor = selectionElement?.closest<HTMLElement>("p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, figcaption")
      ?? selectionElement;
    paginationScrollRef.current = {
      anchor,
      anchorTop: anchor?.getBoundingClientRect().top ?? null,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
      validUntil: Date.now() + 1_500,
    };
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “selected Range” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const selectedRange = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) return selection.getRangeAt(0);
    if (editor && lastRangeRef.current && editor.contains(lastRangeRef.current.commonAncestorContainer)) return lastRangeRef.current;
    return null;
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Active Formats” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const updateActiveFormats = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount && editor?.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : lastRangeRef.current;
    const container = range?.startContainer;
    const element = container?.nodeType === Node.ELEMENT_NODE ? container as Element : container?.parentElement;
    if (!editor || !element || !editor.contains(element)) return;
    const block = element.closest("p,h1,h2,h3,h4,h5,h6,div,li,td,th");
    setActiveFormats({
      alignment: block?.classList.contains("text-center")
        ? "text-center"
        : block?.classList.contains("text-right")
          ? "text-right"
          : "text-left",
      bold: Boolean(element.closest("strong,b")),
      italic: Boolean(element.closest("em,i")),
      underline: Boolean(element.closest("u")),
    });
  }, []);

  useEffect(() => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รับเหตุการณ์ “on Selection Change” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        lastRangeRef.current = selection.getRangeAt(0).cloneRange();
        updateActiveFormats();
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [updateActiveFormats]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รับเหตุการณ์ “handle Toolbar Key Down” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const handleToolbarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “controls” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - control: ค่า “control” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const controls = Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), [role='button']:not([aria-disabled='true'])",
    ) ?? []).filter((control) => control.getClientRects().length > 0);
    if (!controls.length) return;
    const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? controls.length - 1
        : event.key === "ArrowRight"
          ? (currentIndex + 1) % controls.length
          : (currentIndex - 1 + controls.length) % controls.length;
    controls[nextIndex]?.focus();
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “wrap Selection” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - tagName: ค่า “tag Name” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - className: ค่า “class Name” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - style: ค่า “style” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const wrapSelection = (tagName: "strong" | "em" | "u" | "span", className?: string, style?: Partial<CSSStyleDeclaration>) => {
    const range = selectedRange();
    if (!range || range.collapsed) return;
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (style) Object.assign(element.style, style);
    element.append(range.extractContents());
    range.insertNode(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    lastRangeRef.current = null;
    if (tagName === "strong") setActiveFormats((current) => ({ ...current, bold: true }));
    if (tagName === "em") setActiveFormats((current) => ({ ...current, italic: true }));
    if (tagName === "u") setActiveFormats((current) => ({ ...current, underline: true }));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insert Node At Selection” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - node: ค่า “node” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const insertNodeAtSelection = (node: Node) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = selectedRange();
    const selection = window.getSelection();
    if (range) {
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      lastRangeRef.current = range.cloneRange();
      return;
    }
    editor.append(node);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “apply Alignment” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - className: ค่า “class Name” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const applyAlignment = (className: "text-left" | "text-center" | "text-right") => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const container = selection.getRangeAt(0).commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement;
    const block = element?.closest("p,h1,h2,h3,div,li");
    if (!block || !editor.contains(block)) return;
    block.classList.remove("text-left", "text-center", "text-right");
    block.classList.add(className);
    setActiveFormats((current) => ({ ...current, alignment: className }));
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insert Heading” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const insertHeading = () => {
    const selection = window.getSelection();
    const heading = document.createElement("h2");
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const range = selection.getRangeAt(0);
      heading.append(range.extractContents());
      range.insertNode(heading);
      selection.removeAllRanges();
      return;
    }
    heading.textContent = "หัวข้อ";
    insertNodeAtSelection(heading);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insert List” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const insertList = () => {
    const list = document.createElement("ul");
    const item = document.createElement("li");
    item.textContent = "รายการ";
    list.append(item);
    insertNodeAtSelection(list);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insert Table” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const insertTable = () => {
    const table = document.createElement("table");
    const body = document.createElement("tbody");
    for (let rowIndex = 0; rowIndex < tableRows; rowIndex += 1) {
      const row = document.createElement("tr");
      for (let columnIndex = 0; columnIndex < tableColumns; columnIndex += 1) {
        const cell = document.createElement(rowIndex === 0 ? "th" : "td");
        cell.textContent = rowIndex === 0 ? `หัวข้อ ${columnIndex + 1}` : "ข้อความ";
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
    insertNodeAtSelection(table);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insert Page Break” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const insertPageBreak = () => {
    const pageBreak = document.createElement("div");
    pageBreak.className = "page-break";
    insertNodeAtSelection(pageBreak);
    window.requestAnimationFrame(paginateEditor);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “merge With Previous Page” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const mergeWithPreviousPage = () => {
    const editor = editorRef.current;
    const range = selectedRange();
    if (!editor || !range) {
      setError("กรุณาคลิกในหน้าที่ต้องการรวมกับหน้าก่อน");
      return;
    }
    const pageBreaks = Array.from(editor.querySelectorAll<HTMLElement>(".page-break:not(.editor-auto-page-break)"));
    const previousPageBreak = pageBreaks
      .filter((pageBreak) => pageBreak.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING)
      .at(-1);
    if (!previousPageBreak) {
      setError("หน้าแรกไม่สามารถรวมกับหน้าก่อนได้");
      return;
    }
    setError("");
    previousPageBreak.remove();
    lastRangeRef.current = null;
    window.requestAnimationFrame(paginateEditor);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “delete Current Page” ตามกฎของระบบ
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const deleteCurrentPage = () => {
    const editor = editorRef.current;
    const range = selectedRange();
    if (!editor || !range) {
      setError("กรุณาคลิกข้อความในหน้าที่ต้องการลบก่อน");
      return;
    }
    const pageBreaks = Array.from(editor.querySelectorAll<HTMLElement>(".page-break:not(.editor-auto-page-break)"));
    const previousPageBreak = pageBreaks
      .filter((pageBreak) => pageBreak.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING)
      .at(-1);
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “next Page Break” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - pageBreak: ค่า “page Break” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const nextPageBreak = pageBreaks.find((pageBreak) => pageBreak.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_PRECEDING);
    const pageContainer = previousPageBreak?.parentElement ?? nextPageBreak?.parentElement;
    if (!pageContainer || (previousPageBreak && previousPageBreak.parentElement !== pageContainer) || (nextPageBreak && nextPageBreak.parentElement !== pageContainer)) {
      setError("ไม่พบขอบเขตของหน้าที่เลือก");
      return;
    }

    const childNodes = Array.from(pageContainer.childNodes);
    const startIndex = previousPageBreak ? childNodes.indexOf(previousPageBreak) + 1 : 0;
    const endIndex = nextPageBreak ? childNodes.indexOf(nextPageBreak) : childNodes.length;
    const pageNodes = childNodes.slice(startIndex, endIndex);
    if (pageNodes.length === 0) {
      setError("หน้านี้ไม่มีเนื้อหาให้ลบ");
      return;
    }
    pendingPageDeleteRef.current = () => {
      pageNodes.forEach((node) => node.remove());
      if (nextPageBreak) nextPageBreak.remove();
      else previousPageBreak?.remove();
      setError("");
      lastRangeRef.current = null;
      window.requestAnimationFrame(paginateEditor);
    };
    setIsDeletePageConfirmOpen(true);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “active Table Cell” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const activeTableCell = () => {
    const range = selectedRange();
    const container = range?.commonAncestorContainer;
    const element = container?.nodeType === Node.ELEMENT_NODE ? container as Element : container?.parentElement;
    const cell = element?.closest("th,td");
    return cell instanceof HTMLTableCellElement && editorRef.current?.contains(cell) ? cell : null;
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “edit Table” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - action: ค่า “action” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const editTable = (action: "add-row" | "remove-row" | "add-column" | "remove-column") => {
    const cell = activeTableCell();
    const row = cell?.parentElement;
    const table = cell?.closest("table");
    if (!cell || !(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
      setError("กรุณาคลิกในช่องตารางที่ต้องการแก้ไขก่อน");
      return;
    }
    setError("");
    if (action === "add-row") {
      const newRow = table.insertRow(row.rowIndex + 1);
      for (let index = 0; index < row.cells.length; index += 1) newRow.insertCell().textContent = "ข้อความ";
    } else if (action === "remove-row") {
      if (table.rows.length <= 1) return setError("ตารางต้องเหลืออย่างน้อย 1 แถว");
      table.deleteRow(row.rowIndex);
    } else if (action === "add-column") {
      Array.from(table.rows).forEach((currentRow, rowIndex) => {
        const newCell = document.createElement(rowIndex === 0 ? "th" : "td");
        newCell.textContent = rowIndex === 0 ? "หัวข้อ" : "ข้อความ";
        currentRow.cells[cell.cellIndex]?.after(newCell);
      });
    } else {
      if (row.cells.length <= 1) return setError("ตารางต้องเหลืออย่างน้อย 1 คอลัมน์");
      Array.from(table.rows).forEach((currentRow) => currentRow.cells[cell.cellIndex]?.remove());
    }
    lastRangeRef.current = null;
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “confirm Table Deletion” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - action: ค่า “action” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const confirmTableDeletion = async (action: "remove-row" | "remove-column") => {
    const target = action === "remove-row" ? "แถว" : "คอลัมน์";
    if (!activeTableCell()) {
      setError(`กรุณาคลิกในช่องตารางที่ต้องการลบ${target}ก่อน`);
      return;
    }
    if (!await confirm({
      title: `ลบ${target}ตาราง?`,
      description: `ข้อความทั้งหมดใน${target}ที่เลือกจะถูกลบออกจากเอกสาร`,
      confirmLabel: `ลบ${target}`,
      variant: "danger",
    })) return;
    editTable(action);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insert Image” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - file: ค่า “file” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const insertImage = (file: File) => {
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("รองรับเฉพาะรูป PNG, JPEG หรือ WebP");
      return;
    }
    if (file.size > 1_000_000) {
      setError("รูปภาพต้องมีขนาดไม่เกิน 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      const image = document.createElement("img");
      image.alt = file.name.slice(0, 120);
      image.className = "document-image";
      image.src = reader.result;
      insertNodeAtSelection(image);
    });
    reader.addEventListener("error", () => setError("อ่านไฟล์รูปภาพไม่สำเร็จ"));
    reader.readAsDataURL(file);
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “insert Placeholder” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const insertPlaceholder = (key: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const node = document.createTextNode(`{{${key}}}`);
    if (selection && selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.append(node);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save” โดยใช้ค่าที่รับเข้ามา
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const save = async () => {
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, html: editorHtml() }) });
      const result = await response.json() as { error?: string; template?: DocumentTemplateDto };
      if (!response.ok || !result.template) throw new Error(result.error || "บันทึก template ไม่สำเร็จ");
      onSaved(result.template);
      setIsContentDirty(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึก template ไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “preview” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const preview = async () => {
    const previewWindow = window.open("", "_blank");
    setError("");
    setIsPreviewing(true);
    try {
      const draftResponse = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, html: editorHtml() }),
      });
      const draftResult = await draftResponse.json() as { error?: string; template?: DocumentTemplateDto };
      if (!draftResponse.ok || !draftResult.template) throw new Error(draftResult.error || "บันทึกร่างก่อนดูตัวอย่างไม่สำเร็จ");
      onSaved(draftResult.template);
      setIsContentDirty(false);
      const response = await fetch(`/api/documents/preview?propertyId=${encodeURIComponent(propertyId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "สร้างตัวอย่างไม่สำเร็จ");
      }
      const url = URL.createObjectURL(await response.blob());
      if (previewWindow) previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (previewError) {
      previewWindow?.close();
      setError(previewError instanceof Error ? previewError.message : "สร้างตัวอย่างไม่สำเร็จ");
    } finally {
      setIsPreviewing(false);
    }
  };

  const toolbar = (
    <div className="template-editor-toolbar" aria-label="เครื่องมือจัดรูปแบบ" onKeyDown={handleToolbarKeyDown} ref={toolbarRef} role="toolbar">
      <IconButton label="หัวข้อ" onClick={insertHeading} onMouseDown={(event) => event.preventDefault()}><Heading2 size={16} /></IconButton>
      <IconButton aria-pressed={activeFormats.bold} className={activeFormats.bold ? "active" : ""} label="ตัวหนา" onClick={() => wrapSelection("strong")} onMouseDown={(event) => event.preventDefault()}><Bold size={16} /></IconButton>
      <IconButton aria-pressed={activeFormats.italic} className={activeFormats.italic ? "active" : ""} label="ตัวเอียง" onClick={() => wrapSelection("em")} onMouseDown={(event) => event.preventDefault()}><Italic size={16} /></IconButton>
      <IconButton aria-pressed={activeFormats.underline} className={activeFormats.underline ? "active" : ""} label="ขีดเส้นใต้" onClick={() => wrapSelection("u")} onMouseDown={(event) => event.preventDefault()}><Underline size={16} /></IconButton>
      <span className="template-toolbar-divider" />
      <DropdownField
        onChange={(value) => { if (value) wrapSelection("span", undefined, { fontFamily: value }); }}
        options={["Arial", "Tahoma", "Georgia", "Times New Roman"].map((value) => ({ value, label: value }))}
        value=""
      />
      <DropdownField
        onChange={(value) => { if (value) wrapSelection("span", undefined, { fontSize: `${value}px` }); }}
        options={[10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36].map((size) => ({ value: String(size), label: `${size} pt` }))}
        value=""
      />
      <label className="template-color-control" title="สีตัวอักษร"><span>A</span><input aria-label="เลือกสีตัวอักษร" defaultValue="#171717" onMouseDown={rememberSelection} onChange={(event) => wrapSelection("span", undefined, { color: event.target.value })} type="color" /></label>
      <label className="template-color-control highlight" title="สีพื้นข้อความ"><span>สีพื้น</span><input aria-label="เลือกสีพื้นข้อความ" defaultValue="#fff2a8" onMouseDown={rememberSelection} onChange={(event) => wrapSelection("span", undefined, { backgroundColor: event.target.value })} type="color" /></label>
      <span className="template-toolbar-divider" />
      <IconButton aria-pressed={activeFormats.alignment === "text-left"} className={activeFormats.alignment === "text-left" ? "active" : ""} label="ชิดซ้าย" onClick={() => applyAlignment("text-left")} onMouseDown={(event) => event.preventDefault()}><AlignLeft size={16} /></IconButton>
      <IconButton aria-pressed={activeFormats.alignment === "text-center"} className={activeFormats.alignment === "text-center" ? "active" : ""} label="กึ่งกลาง" onClick={() => applyAlignment("text-center")} onMouseDown={(event) => event.preventDefault()}><AlignCenter size={16} /></IconButton>
      <IconButton aria-pressed={activeFormats.alignment === "text-right"} className={activeFormats.alignment === "text-right" ? "active" : ""} label="ชิดขวา" onClick={() => applyAlignment("text-right")} onMouseDown={(event) => event.preventDefault()}><AlignRight size={16} /></IconButton>
      <IconButton label="รายการหัวข้อ" onClick={insertList} onMouseDown={(event) => event.preventDefault()}><List size={16} /></IconButton>
      <div className="template-tool-group">
        <div className="template-tool-group-heading"><strong>ตาราง</strong><span>กำหนดขนาดก่อนสร้าง หรือคลิกในตารางเดิมเพื่อแก้ไข</span></div>
        <div className="template-table-builder">
          <label>จำนวนแถว<input aria-label="จำนวนแถว" max={12} min={1} onMouseDown={rememberSelection} onChange={(event) => setTableRows(Number(event.target.value))} type="number" value={tableRows} /></label>
          <label>จำนวนคอลัมน์<input aria-label="จำนวนคอลัมน์" max={8} min={1} onMouseDown={rememberSelection} onChange={(event) => setTableColumns(Number(event.target.value))} type="number" value={tableColumns} /></label>
          <button className="template-table-insert" aria-label="แทรกตารางตามขนาดที่เลือก" onClick={insertTable} onMouseDown={(event) => event.preventDefault()} title="แทรกตาราง" type="button"><Table2 size={16} /> สร้างตาราง</button>
        </div>
        <div className="template-table-actions" aria-label="แก้ไขตาราง">
          <button aria-label="เพิ่มแถว" onClick={() => editTable("add-row")} onMouseDown={(event) => event.preventDefault()} title="เพิ่มแถวต่อจากช่องที่เลือก" type="button"><Plus size={14} /> เพิ่มแถว</button>
          <button aria-label="ลบแถว" className="destructive-action" onClick={() => void confirmTableDeletion("remove-row")} onMouseDown={(event) => event.preventDefault()} title="ลบแถวของช่องที่เลือก" type="button"><Minus size={14} /> ลบแถว</button>
          <button aria-label="เพิ่มคอลัมน์" onClick={() => editTable("add-column")} onMouseDown={(event) => event.preventDefault()} title="เพิ่มคอลัมน์ต่อจากช่องที่เลือก" type="button"><Plus size={14} /> เพิ่มคอลัมน์</button>
          <button aria-label="ลบคอลัมน์" className="destructive-action" onClick={() => void confirmTableDeletion("remove-column")} onMouseDown={(event) => event.preventDefault()} title="ลบคอลัมน์ของช่องที่เลือก" type="button"><Trash2 size={14} /> ลบคอลัมน์</button>
        </div>
      </div>
      <div className="template-tool-group">
        <div className="template-tool-group-heading"><strong>หน้าเอกสาร</strong><span>วางเคอร์เซอร์ในหน้าที่ต้องการก่อนเลือกคำสั่ง</span></div>
        <div className="template-page-actions" aria-label="จัดการหน้าเอกสาร">
          <button onClick={insertPageBreak} onMouseDown={(event) => event.preventDefault()} title="ย้ายข้อความหลังเคอร์เซอร์ไปเริ่มหน้าใหม่" type="button"><Plus size={14} /> ขึ้นหน้าใหม่</button>
          <button onClick={mergeWithPreviousPage} onMouseDown={(event) => event.preventDefault()} title="นำหน้าปัจจุบันไปรวมกับหน้าก่อนโดยไม่ลบข้อความ" type="button"><Minus size={14} /> รวมกับหน้าก่อน</button>
          <button className="danger" onClick={deleteCurrentPage} onMouseDown={(event) => event.preventDefault()} title="ลบหน้าปัจจุบันพร้อมข้อความทั้งหมด" type="button"><Trash2 size={14} /> ลบหน้าปัจจุบัน</button>
        </div>
      </div>
      <div className="template-tool-group template-image-tools">
        <div className="template-tool-group-heading"><strong>รูปภาพ</strong><span>รองรับ PNG, JPEG และ WebP ขนาดไม่เกิน 1 MB</span></div>
        <button aria-label="แทรกรูปภาพ" onClick={() => imageInputRef.current?.click()} type="button"><ImagePlus size={16} /> เพิ่มรูปภาพ</button>
      </div>
      <input
        accept="image/png,image/jpeg,image/webp"
        className="template-image-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) insertImage(file);
          event.target.value = "";
        }}
        ref={imageInputRef}
        type="file"
      />
    </div>
  );

  const placeholders = (
    <div className="template-placeholder-list">
      {Object.entries(placeholderLabels[kind]).map(([key, label]) => (
        <button key={key} onClick={() => insertPlaceholder(key)} onMouseDown={(event) => event.preventDefault()} type="button">
          <span>{label}</span><code>{`{{${key}}}`}</code>
        </button>
      ))}
    </div>
  );

  return (
    <main className="document-editor-screen">
      <style>{getDocumentContentCss(".document-editor-paper")}</style>
      <header className="document-editor-header">
        <button className="secondary-button document-editor-back" onClick={requestClose} type="button"><ArrowLeft aria-hidden="true" size={17} /> กลับหน้าตั้งค่า</button>
        <div><small>HTML Template + Placeholder</small><h1>{kind === "contract" ? "แก้ไขโครงสัญญา" : "แก้ไขโครงบิล"}</h1></div>
        <div className="document-editor-header-actions">
          <button className="secondary-button" disabled={isPreviewing || isSaving} onClick={() => void preview()} type="button"><Eye size={17} /> {isPreviewing ? "กำลังสร้าง..." : "ดู PDF"}</button>
          <button aria-describedby={!isSaving && !name.trim() ? "document-name-disabled-reason" : undefined} className="primary-button" disabled={isSaving || !name.trim()} onClick={() => void save()} type="button"><Save size={17} /> {isSaving ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      </header>
      {!isSaving && !name.trim() ? <p className="disabled-reason document-editor-disabled-reason" id="document-name-disabled-reason">กรอกชื่อ Template ก่อนบันทึก</p> : null}
      <div className="document-editor-workspace">
        <aside className="document-editor-left">
          <label className="form-field"><span>ชื่อ Template</span><input maxLength={120} onChange={(event) => setName(event.target.value)} value={name} /></label>
          <section><h2>จัดรูปแบบ</h2>{toolbar}</section>
        </aside>
        <section className="document-editor-canvas" aria-label="พื้นที่กระดาษ A4">
          <div className="document-editor-paper-scale" data-zoom={zoom}>
            <div
              aria-label="เนื้อหา template"
              className="template-rich-editor document-editor-paper"
              contentEditable
              onBeforeInput={() => {
                rememberPaginationPosition();
                rememberSelection();
              }}
              onInput={() => {
                if (!paginationScrollRef.current || paginationScrollRef.current.validUntil <= Date.now()) {
                  rememberPaginationPosition();
                } else {
                  paginationScrollRef.current.validUntil = Date.now() + 1_500;
                }
                rememberSelection();
                window.requestAnimationFrame(paginateEditor);
              }}
              onKeyUp={rememberSelection}
              onMouseUp={rememberSelection}
              ref={editorRef}
              role="textbox"
              suppressContentEditableWarning
            />
          </div>
        </section>
        <aside className="document-editor-right">
          <section><h2>มุมมอง</h2><div className="document-zoom-controls"><IconButton disabled={zoom === 75} label="ย่อมุมมอง" onClick={() => setZoom((current) => Math.max(75, current - 25))}><ZoomOut size={16} /></IconButton><strong>{zoom}%</strong><IconButton disabled={zoom === 125} label="ขยายมุมมอง" onClick={() => setZoom((current) => Math.min(125, current + 25))}><ZoomIn size={16} /></IconButton></div></section>
          <section className="document-editor-variables"><h2>ข้อมูลตัวแปร</h2><p>คลิกตัวแปรเพื่อแทรกตรงตำแหน่งเคอร์เซอร์</p>{placeholders}</section>
        </aside>
      </div>
      {error ? <div className="document-editor-error form-hint error" role="alert">{error}</div> : null}
      {isDeletePageConfirmOpen ? (
        <ConfirmationDialog
          confirmLabel="ลบหน้า"
          description="ข้อความและข้อมูลทั้งหมดในหน้าปัจจุบันจะถูกลบ และไม่สามารถเรียกคืนได้"
          onCancel={() => {
            pendingPageDeleteRef.current = null;
            setIsDeletePageConfirmOpen(false);
          }}
          onConfirm={() => {
            pendingPageDeleteRef.current?.();
            pendingPageDeleteRef.current = null;
            setIsDeletePageConfirmOpen(false);
          }}
          title="ลบหน้าปัจจุบันหรือไม่?"
          variant="danger"
        />
      ) : null}
      {confirmationDialog}
    </main>
  );
}
