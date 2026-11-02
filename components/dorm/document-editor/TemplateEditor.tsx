"use client";
// เป็นตัวแก้ไขเอกสาร ต้องแตะ DOM การเลือกข้อความ และวัดขนาดจริงตลอดเวลา

import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Check, ChevronDown, Eye, FilePlus2, FileText, Heading2, ImagePlus, Italic, List, Minus, PenLine, Plus, Redo2, RotateCcw, Save, ScrollText, Table2, Trash2, TriangleAlert, Underline, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/dorm/ConfirmationDialog";
import { DropdownField } from "@/components/dorm/DropdownField";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { useConfirmation } from "@/components/ui/use-confirmation";
import { rovingIndex } from "@/components/ui/use-tablist-keyboard";
import { chipifyPlaceholders, createPlaceholderChip, renderPlaceholderChip, serializePlaceholders, showPlaceholderValues, snippetFragment, usedPlaceholderKeys } from "@/components/dorm/document-editor/placeholder-chips";
import { defaultTemplates } from "@/lib/documents/default-templates";
import { documentFontFaceCss, documentFontOptions } from "@/lib/documents/document-fonts";
import { getDocumentContentCss } from "@/lib/documents/document-styles";
import { placeholderLabels, recommendedPlaceholders } from "@/lib/documents/placeholders";
import { contractClauses, signatureBlockHtml, type TemplateSnippet } from "@/lib/documents/template-snippets";
import type { DocumentKind, DocumentTemplateDto } from "@/lib/documents/types";
import { useUnsavedChanges } from "@/lib/client/use-unsaved-changes";

// ชื่อของแต่ละชนิดเอกสาร ทั้งบนการ์ดในหน้าตั้งค่าและหัวหน้าจอแก้ไข
export const templateTitles: Record<DocumentKind, { panel: string; editor: string }> = {
  contract: { panel: "แบบฟอร์มสัญญา", editor: "แก้ไขแบบฟอร์มสัญญา" },
  invoice: { panel: "แบบฟอร์มบิล", editor: "แก้ไขแบบฟอร์มบิล" },
  receipt: { panel: "แบบฟอร์มใบเสร็จรับเงิน", editor: "แก้ไขแบบฟอร์มใบเสร็จ" },
};

const fontSizes = [10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36];
const zoomSteps = [50, 75, 100, 125, 150];
const editorFontCss = documentFontFaceCss((file) => `/fonts/sarabun/${file}`);

type Alignment = "text-left" | "text-center" | "text-right";
type PreviewValues = { status: "idle" | "loading" | "ready" | "failed"; label: string; values: Record<string, string> | null; error: string };
type Autocomplete = { index: number; left: number; node: Text; offset: number; query: string; top: number };

// การจัดวางของย่อหน้าที่เคอร์เซอร์อยู่ ไม่ได้ใส่คลาสไว้ก็ถือว่าชิดซ้ายตามค่าเริ่มต้น
function blockAlignment(block: Element | null): Alignment {
  if (block?.classList.contains("text-center")) return "text-center";
  return block?.classList.contains("text-right") ? "text-right" : "text-left";
}

// โหนดที่ช่วงเลือกเริ่มต้นจริง ๆ ถ้าจุดเริ่มเป็นตำแหน่งระหว่างลูกของ element ให้ใช้ลูกตัวที่อยู่ตรงนั้น
// เลือกคลุมแท็บตัวหนาทั้งก้อนแล้วจุดเริ่มจะอยู่ที่ย่อหน้าแม่ ถ้าไม่ไล่ลงไปจะไม่รู้ว่าข้อความที่เลือกเป็นตัวหนาอยู่
function rangeStartElement(range: Range) {
  const { startContainer, startOffset } = range;
  if (startContainer instanceof Element) {
    const child = startContainer.childNodes[startOffset];
    if (child instanceof Element) return child;
    return child?.parentElement ?? startContainer;
  }
  return startContainer.parentElement;
}

// ตำแหน่งของเคอร์เซอร์บนจอ ใช้วางกล่องเลือกข้อมูลตอนพิมพ์ @
// เคอร์เซอร์ที่อยู่ต้นบรรทัดว่างบางทีวัดได้กรอบศูนย์ จึงถอยไปใช้กรอบของย่อหน้าแทน
function caretRect(range: Range) {
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (rect && (rect.width || rect.height)) return rect;
  const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  return element?.getBoundingClientRect() ?? null;
}

async function loadPreviewValues(kind: DocumentKind, propertyId: string) {
  const response = await fetch(`/api/documents/preview-data?propertyId=${encodeURIComponent(propertyId)}&kind=${kind}`, { cache: "no-store" });
  const result = await response.json() as { error?: string; label?: string; values?: Record<string, string> };
  if (!response.ok || !result.values) throw new Error(result.error || "โหลดข้อมูลตัวอย่างไม่สำเร็จ");
  return { label: result.label ?? "", values: result.values };
}

// ตัวแก้ไขเอกสารแบบเห็นผลจริง ใช้ contentEditable ของเบราว์เซอร์แทนการดึงไลบรารีมาทั้งตัว
// หน้ากระดาษเป็น A4 และแบ่งหน้าให้อัตโนมัติ เพื่อให้สิ่งที่เห็นตรงกับ PDF ที่จะออกมา
export function TemplateEditor({ kind, onClose, onSaved, propertyId, template }: Readonly<{ kind: DocumentKind; onClose: () => void; onSaved: (template: DocumentTemplateDto) => void; propertyId: string; template: DocumentTemplateDto }>) {
  const labels = placeholderLabels[kind];
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // HTML ตอนเปิดหรือบันทึกล่าสุด (แปลงป้ายกลับเป็น {{key}} แล้ว) ใช้เทียบว่าแก้อะไรไปหรือยัง
  const savedHtmlRef = useRef("");
  // กันไม่ให้การแบ่งหน้าเรียกตัวเองซ้ำ เพราะการแทรกตัวคั่นทำให้ DOM เปลี่ยนแล้วไปกระตุ้นรอบใหม่
  const isPaginatingRef = useRef(false);
  // จำตำแหน่งที่เลือกไว้ เพราะกดปุ่มบนแถบเครื่องมือแล้วโฟกัสจะหลุดออกจากตัวแก้ไข
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
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [isClauseDialogOpen, setIsClauseDialogOpen] = useState(false);
  const [tableColumns, setTableColumns] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  // "fit" คือย่อกระดาษให้พอดีความกว้างของกรอบ เป็นค่าเริ่มต้น จอเล็กจะได้ไม่ต้องเลื่อนซ้ายขวา
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [fitPercent, setFitPercent] = useState(100);
  const canvasRef = useRef<HTMLElement>(null);
  const [isContentDirty, setIsContentDirty] = useState(false);
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewValues>({ status: "idle", label: "", values: null, error: "" });
  const [showValues, setShowValues] = useState(false);
  const [autocomplete, setAutocomplete] = useState<Autocomplete | null>(null);
  const [activeFormats, setActiveFormats] = useState({
    alignment: "text-left" as Alignment,
    bold: false,
    fontFamily: "Sarabun",
    fontSize: "14",
    inTable: false,
    italic: false,
    underline: false,
  });

  // ค่าที่ป้ายควรแสดงตอนนี้ null คือแสดงชื่อช่อง
  const displayValues = showValues ? preview.values : null;
  // ฟังก์ชันที่สร้างป้ายใหม่ต้องรู้ค่าปัจจุบันโดยไม่ต้องสร้างฟังก์ชันใหม่ทุกครั้งที่สลับโหมด
  const displayValuesRef = useRef(displayValues);

  // แบ่งหน้าเอง โดยวัดว่าเนื้อหาล้นขอบกระดาษ A4 ตรงไหนแล้วแทรกตัวคั่นหน้าเข้าไป
  // ทำเองเพราะ CSS อย่างเดียวคุมไม่ได้ว่าจะขึ้นหน้าใหม่ตรงไหนขณะพิมพ์อยู่
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
    // ล้างตัวคั่นที่ระบบใส่ไว้รอบก่อนทิ้งก่อน แล้วค่อยคำนวณใหม่ทั้งหมด
    // ตัวคั่นที่ผู้ใช้ใส่เองไม่โดนลบ เพราะคนละคลาสกัน
    editor.querySelectorAll(".editor-auto-page-break").forEach((pageBreak) => pageBreak.remove());
    // A4 กว้าง 210 มม. สูง 297 มม. ใช้ offsetWidth ซึ่งไม่เปลี่ยนตามการซูม
    // offsetTop ของเนื้อหาก็ไม่เปลี่ยนตามการซูมเหมือนกัน ตัวเลขทั้งสองฝั่งจึงอยู่ในหน่วยเดียวกันเสมอ
    const pixelsPerMillimeter = editor.offsetWidth / 210;
    const pageHeight = 297 * pixelsPerMillimeter;
    // ขอบกระดาษ 18 มม. ทั้งบนและล่าง ตรงกับ @page ของ PDF
    const pagePadding = 18 * pixelsPerMillimeter;
    const pageGap = 38;
    // ยืดตัวคั่นให้สูงพอดันเนื้อหาที่เหลือไปเริ่มต้นหน้าถัดไปพอดี เหมือนหน้ากระดาษจริง
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
    // แทรกตัวคั่นทีละอัน แล้ววัดใหม่ เพราะแทรกแล้วตำแหน่งของทุกอย่างข้างล่างเลื่อนหมด
    // จำกัด 50 รอบกันวนไม่จบ ถ้ามีบล็อกที่สูงเกินหนึ่งหน้าจนแบ่งยังไงก็ยังล้น
    for (let pass = 0; pass < 50; pass += 1) {
      // หาบล็อกแรกที่ล้นขอบล่างของหน้าที่มันอยู่ และยังไม่มีตัวคั่นนำหน้าอยู่แล้ว
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
      // contentEditable=false กันผู้ใช้เผลอพิมพ์ลงในตัวคั่นที่ระบบสร้าง
      automaticBreak.contentEditable = "false";
      overflowingBlock.before(automaticBreak);
      fillPageBreaks();
    }
    // คืนตำแหน่งเคอร์เซอร์ เพราะการแทรกตัวคั่นทำให้การเลือกข้อความหลุด
    if (previousRange && editor.contains(previousRange.commonAncestorContainer)) {
      selection?.removeAllRanges();
      selection?.addRange(previousRange);
      lastRangeRef.current = previousRange.cloneRange();
    }
    if (viewport) {
      // ตรึงตำแหน่งการเลื่อนไว้ที่ย่อหน้าที่กำลังพิมพ์อยู่ ไม่ให้หน้ากระโดดหลังแบ่งหน้าใหม่
      const restoreScroll = () => {
        viewport.scrollLeft = previousScrollLeft;
        if (scrollAnchor && scrollAnchorTop !== null && scrollAnchor.isConnected) {
          viewport.scrollTop += scrollAnchor.getBoundingClientRect().top - scrollAnchorTop;
        } else {
          viewport.scrollTop = previousScrollTop;
        }
      };
      // เรียกซ้ำหลายจังหวะ เพราะรูปกับฟอนต์ทยอยโหลดเสร็จแล้วทำให้ความสูงเปลี่ยนอีกหลังจากนี้
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
      window.setTimeout(restoreScroll, 50);
      window.setTimeout(restoreScroll, 150);
      window.setTimeout(restoreScroll, 300);
      window.setTimeout(restoreScroll, 600);
    }
    isPaginatingRef.current = false;
  }, []);

  // ดึง HTML ที่จะบันทึก ทำบนสำเนาเพื่อไม่ให้กระทบสิ่งที่ผู้ใช้กำลังแก้อยู่
  const editorHtml = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return "";
    const clone = editor.cloneNode(true) as HTMLElement;
    // ป้ายกลับเป็น {{key}} ตัวคั่นกับค่าความสูงที่ระบบใส่ไว้ก็ตัดออก เพราะเป็นของสำหรับแสดงผลเท่านั้น
    serializePlaceholders(clone);
    clone.querySelectorAll(".editor-auto-page-break").forEach((pageBreak) => pageBreak.remove());
    clone.querySelectorAll<HTMLElement>(".page-break").forEach((pageBreak) => {
      pageBreak.style.removeProperty("--editor-page-fill");
      if (!pageBreak.getAttribute("style")) pageBreak.removeAttribute("style");
    });
    const documentRoot = clone.querySelector<HTMLElement>(".document") ?? clone;
    // ย่อหน้าว่างท้ายเอกสารเกิดจากการกด Enter ค้างไว้ ไม่ต้องเก็บ
    // แต่ต้องไม่ตัดรูป เส้นคั่น หรือตารางทิ้ง แม้จะไม่มีข้อความอยู่ข้างใน
    const isEmptyTrailingBlock = (element: HTMLElement) => {
      if (element.matches("img,hr,table") || element.querySelector("img,hr,table")) return false;
      return element.textContent?.replaceAll(" ", " ").trim() === "";
    };
    while (documentRoot.lastElementChild instanceof HTMLElement) {
      const lastElement = documentRoot.lastElementChild;
      if (!lastElement.classList.contains("page-break") && !isEmptyTrailingBlock(lastElement)) break;
      lastElement.remove();
    }
    return clone.innerHTML;
  }, []);

  // ใส่ HTML ลงตัวแก้ไข แปลงช่องเป็นป้าย แล้วแบ่งหน้าใหม่ ใช้ทั้งตอนเปิดและตอนคืนค่าแบบฟอร์มมาตรฐาน
  const loadIntoEditor = useCallback((html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = html;
    chipifyPlaceholders(editor, labels);
    showPlaceholderValues(editor, labels, displayValuesRef.current);
    setUsedKeys(usedPlaceholderKeys(editor));
    window.requestAnimationFrame(paginateEditor);
  }, [labels, paginateEditor]);

  const isDirty = name !== template.name || isContentDirty;
  // ยังไม่ได้แก้อะไรก็ปิดไปเลย แก้แล้วต้องถามก่อน ไม่งั้นกดพลาดแล้วที่พิมพ์ไว้หายหมด
  const requestClose = useCallback(() => {
    if (!isDirty) return onClose();
    void confirm({ title: "ทิ้งข้อมูลที่แก้ไข?", description: "เนื้อหาเอกสารที่ยังไม่บันทึกจะหายไป", confirmLabel: "ทิ้งข้อมูล" }).then((ok) => { if (ok) onClose(); });
  }, [confirm, isDirty, onClose]);
  // เตือนอีกชั้นตอนผู้ใช้กดปิดแท็บหรือกดย้อนกลับของเบราว์เซอร์
  useUnsavedChanges(isDirty);

  const zoomPercent = zoomMode === "fit" ? fitPercent : zoomMode;
  const zoomOutTarget = zoomSteps.findLast((step) => step < zoomPercent - 1);
  const zoomInTarget = zoomSteps.find((step) => step > zoomPercent + 1);

  // วัดกรอบทุกครั้งที่ขนาดเปลี่ยน แล้วคำนวณว่าต้องย่อเท่าไรกระดาษ A4 ถึงจะพอดี ไม่ขยายเกิน 100%
  useEffect(() => {
    const canvas = canvasRef.current;
    const paper = editorRef.current;
    if (!canvas || !paper) return;
    const measure = () => {
      const style = getComputedStyle(canvas);
      const available = canvas.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
      // offsetWidth ไม่เปลี่ยนตามการซูม จึงได้ความกว้างจริงของ A4 เสมอ
      setFitPercent(Math.max(30, Math.min(100, Math.floor((available / paper.offsetWidth) * 100))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // ---- ย้อนกลับและทำซ้ำ ----
  // ตัวแก้ไขแก้ DOM เองแทบทุกคำสั่ง ประวัติ undo ของเบราว์เซอร์จึงไม่รู้เรื่อง ต้องเก็บภาพก่อนแก้ไว้เอง
  // เก็บเป็น HTML ที่แปลงป้ายกลับเป็น {{key}} แล้ว ตอนย้อนก็โหลดใหม่ผ่าน loadIntoEditor เหมือนตอนเปิดหน้า
  // เก็บชื่อแบบฟอร์มไปด้วย เพราะคืนค่ามาตรฐานเปลี่ยนทั้งเนื้อหาและชื่อ ย้อนกลับต้องได้ทั้งสองอย่างคืน
  type Snapshot = { html: string; name: string };
  const historyRef = useRef<{ redo: Snapshot[]; typingAt: number; undo: Snapshot[] }>({ redo: [], typingAt: 0, undo: [] });
  const [historySize, setHistorySize] = useState({ redo: 0, undo: 0 });
  const syncHistorySize = () => setHistorySize({ redo: historyRef.current.redo.length, undo: historyRef.current.undo.length });

  // เรียกก่อนทุกคำสั่งที่แก้เอกสาร เก็บสภาพปัจจุบันไว้ให้ย้อนกลับมาได้
  const pushHistory = () => {
    const history = historyRef.current;
    const snapshot = { html: editorHtml(), name };
    const previous = history.undo.at(-1);
    if (previous?.html === snapshot.html && previous.name === snapshot.name) return;
    // เก็บย้อนหลัง 100 ขั้น พอสำหรับการแก้แบบฟอร์มหนึ่งรอบโดยไม่กินหน่วยความจำมากเกินไป
    history.undo = [...history.undo.slice(-99), snapshot];
    history.redo = [];
    syncHistorySize();
  };

  // พิมพ์ต่อเนื่องนับเป็นขั้นเดียว เว้นช่วงเกินหนึ่งวินาทีค่อยนับเป็นขั้นใหม่ เหมือนโปรแกรมพิมพ์เอกสารทั่วไป
  const pushTypingHistory = () => {
    const now = Date.now();
    if (now - historyRef.current.typingAt > 1_000) pushHistory();
    historyRef.current.typingAt = now;
  };

  const stepHistory = (direction: "undo" | "redo") => {
    const history = historyRef.current;
    const target = history[direction].at(-1);
    if (target === undefined) return;
    const opposite = direction === "undo" ? "redo" : "undo";
    history[direction] = history[direction].slice(0, -1);
    history[opposite] = [...history[opposite], { html: editorHtml(), name }];
    history.typingAt = 0;
    lastRangeRef.current = null;
    loadIntoEditor(target.html);
    setName(target.name);
    syncHistorySize();
  };

  useEffect(() => {
    loadIntoEditor(template.html);
    // เปิดแบบฟอร์มใหม่หรือเพิ่งบันทึก เริ่มประวัติใหม่ ไม่ให้ย้อนกลับไปเนื้อหาของรอบก่อน
    historyRef.current = { redo: [], typingAt: 0, undo: [] };
    setHistorySize({ redo: 0, undo: 0 });
    // เทียบกับ HTML หลังแปลงไปกลับหนึ่งรอบ ช่องที่เขียนว่า {{ key }} มีเว้นวรรคจะได้ไม่ถูกนับว่าแก้แล้ว
    savedHtmlRef.current = editorHtml();
    setIsContentDirty(false);
  }, [editorHtml, loadIntoEditor, template.html]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const observer = new ResizeObserver(paginateEditor);
    observer.observe(editor);
    // ฟอนต์ไทยโหลดเสร็จทีหลัง ความสูงของบรรทัดเปลี่ยน ต้องแบ่งหน้าใหม่อีกรอบ
    void document.fonts?.ready.then(paginateEditor);
    return () => observer.disconnect();
  }, [paginateEditor]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const observer = new MutationObserver(() => {
      setIsContentDirty(editorHtml() !== savedHtmlRef.current);
      setUsedKeys(usedPlaceholderKeys(editor));
    });
    observer.observe(editor, { attributes: true, characterData: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, [editorHtml]);

  // สลับป้ายทุกอันระหว่างชื่อช่องกับค่าจริง ความยาวข้อความเปลี่ยน จึงต้องแบ่งหน้าใหม่ด้วย
  useEffect(() => {
    displayValuesRef.current = displayValues;
    const editor = editorRef.current;
    if (!editor) return;
    showPlaceholderValues(editor, labels, displayValues);
    window.requestAnimationFrame(paginateEditor);
  }, [displayValues, labels, paginateEditor]);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    lastRangeRef.current = range.cloneRange();
  };

  // จำย่อหน้าที่เคอร์เซอร์อยู่ไว้ก่อนแบ่งหน้าใหม่ จะได้เลื่อนกลับมาที่เดิมได้แม้ความสูงเปลี่ยน
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
      // หมดอายุใน 1.5 วินาที เลยจากนั้นถือว่าผู้ใช้เลื่อนเองแล้ว อย่าไปดึงกลับ
      validUntil: Date.now() + 1_500,
    };
  };

  // เอาช่วงที่เลือกอยู่ ถ้าโฟกัสหลุดไปที่แถบเครื่องมือแล้วก็ใช้ช่วงที่จำไว้ล่าสุดแทน
  const selectedRange = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) return selection.getRangeAt(0);
    if (editor && lastRangeRef.current && editor.contains(lastRangeRef.current.commonAncestorContainer)) return lastRangeRef.current;
    return null;
  };

  const updateActiveFormats = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const range = selection?.rangeCount && editor?.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : lastRangeRef.current;
    const element = range ? rangeStartElement(range) : null;
    if (!editor || !element || !editor.contains(element)) return;
    const block = element.closest("p,h1,h2,h3,h4,h5,h6,div,li,td,th");
    const style = getComputedStyle(element);
    // ฟอนต์ตัวแรกในรายการคือฟอนต์ที่ตั้งไว้ ตัดเครื่องหมายคำพูดออกให้ตรงกับค่าในตัวเลือก
    const fontFamily = style.fontFamily.split(",")[0]?.replaceAll(/["']/g, "").trim() ?? "";
    setActiveFormats({
      alignment: blockAlignment(block),
      bold: Boolean(element.closest("strong,b")),
      fontFamily,
      fontSize: String(Math.round(Number.parseFloat(style.fontSize))),
      inTable: Boolean(element.closest("td,th")),
      italic: Boolean(element.closest("em,i")),
      underline: Boolean(element.closest("u")),
    });
  }, []);

  useEffect(() => {
    // ฟังการเลือกข้อความที่ระดับ document เพราะ selection ไม่ได้ส่ง event ที่ตัว element
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

  // แถบเครื่องมือเป็น toolbar ตามมาตรฐาน ARIA ต้องเลื่อนด้วยลูกศร ไม่ใช่ Tab ทีละปุ่ม
  const handleToolbarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const controls = Array.from(toolbarRef.current?.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), [role='button']:not([aria-disabled='true'])",
    ) ?? []).filter((control) => control.getClientRects().length > 0 && !control.closest("[role='menu'],[role='listbox']"));
    if (!controls.length) return;
    const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const nextIndex = rovingIndex(event.key, currentIndex, controls.length);
    controls[nextIndex]?.focus();
  };

  // เลือกข้อความเดิมกลับมาหลังจัดรูปแบบ กดปุ่มอื่นต่อได้เลยโดยไม่ต้องลากคลุมใหม่
  // insideElement คือเลือกเนื้อในของแท็บที่เพิ่งครอบ ปุ่มจะได้เห็นว่าข้อความนั้นเป็นตัวหนาแล้วและกดซ้ำเพื่อเอาออกได้
  const selectNodes = (first: Node, last: Node, insideElement = false) => {
    const range = document.createRange();
    if (insideElement) range.selectNodeContents(first);
    else {
      range.setStartBefore(first);
      range.setEndAfter(last);
    }
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    lastRangeRef.current = range.cloneRange();
    updateActiveFormats();
  };

  const formattedRange = () => {
    const range = selectedRange();
    if (!range || range.collapsed) {
      setError("เลือกข้อความที่ต้องการจัดรูปแบบก่อน");
      return null;
    }
    setError("");
    return range;
  };

  // ครอบข้อความที่เลือกด้วยแท็บที่ต้องการ ใช้แทน document.execCommand ที่เลิกใช้แล้ว
  const wrapSelection = (tagName: "strong" | "em" | "u" | "span", className?: string, style?: Partial<CSSStyleDeclaration>) => {
    const range = formattedRange();
    if (!range) return;
    pushHistory();
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (style) Object.assign(element.style, style);
    element.append(range.extractContents());
    range.insertNode(element);
    selectNodes(element, element, true);
  };

  // ปุ่มตัวหนา ตัวเอียง ขีดเส้นใต้ กดซ้ำต้องเอารูปแบบออก ไม่ใช่ครอบซ้อนอีกชั้น
  const toggleInlineFormat = (tagName: "strong" | "em" | "u") => {
    const selector = { strong: "strong,b", em: "em,i", u: "u" }[tagName];
    const range = formattedRange();
    const editor = editorRef.current;
    if (!range || !editor) return;
    const startElement = rangeStartElement(range);
    if (!startElement?.closest(selector) || !editor.contains(startElement)) {
      wrapSelection(tagName);
      return;
    }
    pushHistory();
    const commonElement = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const enclosing = commonElement?.closest(selector);
    if (enclosing && editor.contains(enclosing)) {
      // ข้อความที่เลือกอยู่ในแท็บเดียวกันทั้งหมด แยกแท็บออกเป็นสามท่อน ก่อนหน้า ตรงที่เลือก และหลัง
      // แล้วถอดแท็บออกเฉพาะท่อนกลาง ข้อความรอบ ๆ จึงยังเป็นตัวหนาเหมือนเดิม
      const before = document.createRange();
      before.setStart(enclosing, 0);
      before.setEnd(range.startContainer, range.startOffset);
      const after = document.createRange();
      after.setStart(range.endContainer, range.endOffset);
      after.setEnd(enclosing, enclosing.childNodes.length);
      const beforeContent = before.extractContents();
      const afterContent = after.extractContents();
      const middle = Array.from(enclosing.childNodes);
      const pieces: Node[] = [];
      if (beforeContent.textContent) {
        const head = enclosing.cloneNode(false);
        head.appendChild(beforeContent);
        pieces.push(head);
      }
      pieces.push(...middle);
      if (afterContent.textContent) {
        const tail = enclosing.cloneNode(false);
        tail.appendChild(afterContent);
        pieces.push(tail);
      }
      enclosing.replaceWith(...pieces);
      middle.forEach((node) => { if (node instanceof Element) node.querySelectorAll(selector).forEach((inner) => inner.replaceWith(...Array.from(inner.childNodes))); });
      if (middle.length) selectNodes(middle[0], middle[middle.length - 1]);
      return;
    }
    // เลือกคร่อมหลายแท็บ ดึงส่วนที่เลือกออกมา ถอดแท็บทุกอันข้างในแล้ววางกลับที่เดิม
    const content = range.extractContents();
    content.querySelectorAll(selector).forEach((inner) => inner.replaceWith(...Array.from(inner.childNodes)));
    const nodes = Array.from(content.childNodes);
    range.insertNode(content);
    if (nodes.length) selectNodes(nodes[0], nodes[nodes.length - 1]);
  };

  // วางเคอร์เซอร์ต่อท้ายสิ่งที่เพิ่งแทรก ต้องจำช่วงไว้ก่อนโฟกัสตัวแก้ไข
  // เพราะโฟกัสแล้วเบราว์เซอร์อาจย้ายเคอร์เซอร์ไปต้นเอกสารแทนจุดที่ผู้ใช้คลิกไว้
  const placeCaretAfter = (node: Node) => {
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    lastRangeRef.current = range.cloneRange();
  };

  const insertNodeAtSelection = (node: Node) => {
    const editor = editorRef.current;
    if (!editor) return;
    pushHistory();
    const range = selectedRange()?.cloneRange() ?? null;
    editor.focus({ preventScroll: true });
    if (range) {
      range.deleteContents();
      range.insertNode(node);
      placeCaretAfter(node);
      return;
    }
    (editor.querySelector(".document") ?? editor).append(node);
  };

  // บล็อกใหญ่อย่างข้อสัญญาหรือลายเซ็นต้องอยู่เป็นย่อหน้าของตัวเอง จึงวางต่อจากย่อหน้าที่เคอร์เซอร์อยู่
  // ไม่ใช่แทรกกลางประโยค ถ้ายังไม่ได้คลิกในเอกสารก็ต่อท้ายเอกสาร
  const insertBlock = (fragment: DocumentFragment) => {
    const editor = editorRef.current;
    if (!editor) return;
    pushHistory();
    const documentRoot = editor.querySelector<HTMLElement>(".document") ?? editor;
    const range = selectedRange();
    const container = range?.startContainer;
    const element = container?.nodeType === Node.ELEMENT_NODE ? container as Element : container?.parentElement;
    let block = element && documentRoot.contains(element) ? element : null;
    while (block && block.parentElement !== documentRoot) block = block.parentElement;
    const lastInserted = fragment.lastChild;
    if (block && block !== documentRoot) block.after(fragment);
    else documentRoot.append(fragment);
    // ป้ายในข้อความสำเร็จรูปต้องแสดงแบบเดียวกับป้ายอื่น ตอนเปิดโหมดข้อมูลจริงอยู่ก็ต้องเป็นค่าจริงด้วย
    showPlaceholderValues(documentRoot, labels, displayValuesRef.current);
    if (lastInserted) {
      editor.focus({ preventScroll: true });
      placeCaretAfter(lastInserted);
      (lastInserted as HTMLElement).scrollIntoView?.({ block: "nearest" });
    }
    window.requestAnimationFrame(paginateEditor);
  };

  const applyAlignment = (className: Alignment) => {
    const editor = editorRef.current;
    const range = selectedRange();
    if (!editor || !range) return;
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.ELEMENT_NODE ? container as Element : container.parentElement;
    const block = element?.closest("p,h1,h2,h3,div,li");
    if (!block || !editor.contains(block)) return;
    pushHistory();
    block.classList.remove("text-left", "text-center", "text-right");
    block.classList.add(className);
    setActiveFormats((current) => ({ ...current, alignment: className }));
  };

  const insertHeading = () => {
    const range = selectedRange();
    const heading = document.createElement("h2");
    if (range && !range.collapsed) {
      pushHistory();
      heading.append(range.extractContents());
      range.insertNode(heading);
      window.getSelection()?.removeAllRanges();
      return;
    }
    heading.textContent = "หัวข้อ";
    insertNodeAtSelection(heading);
  };

  const insertList = () => {
    const list = document.createElement("ul");
    const item = document.createElement("li");
    item.textContent = "รายการ";
    list.append(item);
    insertNodeAtSelection(list);
  };

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
    const fragment = document.createDocumentFragment();
    fragment.append(table);
    insertBlock(fragment);
    setIsTableDialogOpen(false);
  };

  const insertPageBreak = () => {
    const pageBreak = document.createElement("div");
    pageBreak.className = "page-break";
    const fragment = document.createDocumentFragment();
    fragment.append(pageBreak);
    insertBlock(fragment);
  };

  const mergeWithPreviousPage = () => {
    const editor = editorRef.current;
    const range = selectedRange();
    if (!editor || !range) {
      setError("คลิกในหน้าที่ต้องการรวมกับหน้าก่อน แล้วเลือกคำสั่งอีกครั้ง");
      return;
    }
    const pageBreaks = Array.from(editor.querySelectorAll<HTMLElement>(".page-break:not(.editor-auto-page-break)"));
    const previousPageBreak = pageBreaks
      .findLast((pageBreak) => pageBreak.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (!previousPageBreak) {
      setError("หน้านี้ขึ้นหน้าใหม่เองเพราะเนื้อหาเต็มหน้า ไม่ได้มาจากการกดขึ้นหน้าใหม่ จึงรวมกับหน้าก่อนไม่ได้");
      return;
    }
    setError("");
    pushHistory();
    previousPageBreak.remove();
    lastRangeRef.current = null;
    window.requestAnimationFrame(paginateEditor);
  };

  const deleteCurrentPage = () => {
    const editor = editorRef.current;
    const range = selectedRange();
    if (!editor || !range) {
      setError("คลิกข้อความในหน้าที่ต้องการลบ แล้วเลือกคำสั่งอีกครั้ง");
      return;
    }
    const pageBreaks = Array.from(editor.querySelectorAll<HTMLElement>(".page-break:not(.editor-auto-page-break)"));
    const previousPageBreak = pageBreaks
      .findLast((pageBreak) => pageBreak.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING);
    const nextPageBreak = pageBreaks.find((pageBreak) => pageBreak.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_PRECEDING);
    const pageContainer = previousPageBreak?.parentElement ?? nextPageBreak?.parentElement;
    if (!pageContainer || (previousPageBreak && previousPageBreak.parentElement !== pageContainer) || (nextPageBreak && nextPageBreak.parentElement !== pageContainer)) {
      setError("ลบได้เฉพาะหน้าที่แบ่งด้วยคำสั่งขึ้นหน้าใหม่ หน้านี้ขึ้นใหม่เองเพราะเนื้อหาเต็มหน้า");
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
      pushHistory();
      pageNodes.forEach((node) => node.remove());
      if (nextPageBreak) nextPageBreak.remove();
      else previousPageBreak?.remove();
      setError("");
      lastRangeRef.current = null;
      window.requestAnimationFrame(paginateEditor);
    };
    setIsDeletePageConfirmOpen(true);
  };

  const activeTableCell = () => {
    const range = selectedRange();
    const container = range?.commonAncestorContainer;
    const element = container?.nodeType === Node.ELEMENT_NODE ? container as Element : container?.parentElement;
    const cell = element?.closest("th,td");
    return cell instanceof HTMLTableCellElement && editorRef.current?.contains(cell) ? cell : null;
  };

  const editTable = (action: "add-row" | "remove-row" | "add-column" | "remove-column") => {
    const cell = activeTableCell();
    const row = cell?.parentElement;
    const table = cell?.closest("table");
    if (!cell || !(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
      setError("คลิกในช่องตารางที่ต้องการแก้ไขก่อน");
      return;
    }
    setError("");
    pushHistory();
    if (action === "add-row") {
      const newRow = table.insertRow(row.rowIndex + 1);
      // แถวใหม่ต้องมีจำนวนช่องเท่าแถวที่กดเพิ่ม ไม่งั้นตารางเบี้ยว
      Array.from(row.cells).forEach(() => { newRow.insertCell().textContent = "ข้อความ"; });
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

  const confirmTableDeletion = async (action: "remove-row" | "remove-column") => {
    const target = action === "remove-row" ? "แถว" : "คอลัมน์";
    if (!activeTableCell()) {
      setError(`คลิกในช่องตารางที่ต้องการลบ${target}ก่อน`);
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

  // แทรกป้ายข้อมูลจากระบบ ตอนสร้างเอกสารจริงจะกลายเป็นข้อมูลของห้องหรือผู้เช่า
  const insertPlaceholder = (key: string, replace?: Range) => {
    const editor = editorRef.current;
    if (!editor) return;
    pushHistory();
    const chip = createPlaceholderChip(key, labels[key] ?? key);
    renderPlaceholderChip(chip, labels, displayValuesRef.current);
    const range = replace ?? selectedRange()?.cloneRange() ?? null;
    editor.focus({ preventScroll: true });
    if (range) {
      range.deleteContents();
      range.insertNode(chip);
    } else {
      (editor.querySelector(".document") ?? editor).append(chip);
    }
    // เว้นวรรคต่อท้ายป้ายเมื่อข้างหลังไม่มีข้อความ เคอร์เซอร์จะได้มีที่อยู่หลังป้ายและพิมพ์ต่อได้ทันที
    const next = chip.nextSibling;
    if (!(next instanceof Text) || !next.nodeValue) chip.after(document.createTextNode(" "));
    placeCaretAfter(chip);
  };

  // ---- พิมพ์ @ เพื่อเลือกข้อมูลจากระบบ ----
  const autocompleteOptions = useMemo(() => {
    if (!autocomplete) return [];
    const query = autocomplete.query.toLowerCase();
    return Object.entries(labels)
      .filter(([key, label]) => !query || label.includes(autocomplete.query) || key.includes(query))
      .slice(0, 8);
  }, [autocomplete, labels]);

  const updateAutocomplete = () => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const node = range?.startContainer;
    if (!range || !range.collapsed || !(node instanceof Text) || !editorRef.current?.contains(node)) {
      setAutocomplete(null);
      return;
    }
    const match = /@([^\s@]{0,30})$/.exec((node.nodeValue ?? "").slice(0, range.startOffset));
    const rect = match ? caretRect(range) : null;
    if (!match || !rect) {
      setAutocomplete(null);
      return;
    }
    setAutocomplete((current) => ({
      index: current?.query === match[1] ? current.index : 0,
      left: Math.min(rect.left, window.innerWidth - 300),
      node,
      offset: range.startOffset,
      query: match[1],
      top: rect.bottom + 6,
    }));
  };

  const chooseAutocomplete = (key: string) => {
    if (!autocomplete) return;
    const { node, offset, query } = autocomplete;
    setAutocomplete(null);
    if (!node.isConnected) return;
    // แทนที่ "@คำค้น" ทั้งก้อนด้วยป้าย
    const range = document.createRange();
    range.setStart(node, Math.max(0, offset - query.length - 1));
    range.setEnd(node, offset);
    insertPlaceholder(key, range);
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
      event.preventDefault();
      stepHistory(key === "y" || event.shiftKey ? "redo" : "undo");
      return;
    }
    if (!autocomplete || autocompleteOptions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setAutocomplete({ ...autocomplete, index: (autocomplete.index + step + autocompleteOptions.length) % autocompleteOptions.length });
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      chooseAutocomplete(autocompleteOptions[autocomplete.index]?.[0] ?? autocompleteOptions[0][0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setAutocomplete(null);
    }
  };

  const insertSnippet = (snippet: TemplateSnippet) => {
    insertBlock(snippetFragment(snippet.html, labels));
    setIsClauseDialogOpen(false);
  };

  // ---- ข้อมูลจริงสำหรับดูตัวอย่าง ----
  // โหลดค่าตัวอย่างมาไว้ตั้งแต่เปิด รายการข้อมูลด้านข้างจะได้โชว์ค่าจริงให้ดูคู่กับชื่อช่อง
  useEffect(() => {
    let isCurrent = true;
    setPreview({ status: "loading", label: "", values: null, error: "" });
    loadPreviewValues(kind, propertyId).then(
      (result) => { if (isCurrent) setPreview({ status: "ready", label: result.label, values: result.values, error: "" }); },
      (previewError: unknown) => {
        if (!isCurrent) return;
        setPreview({ status: "failed", label: "", values: null, error: previewError instanceof Error ? previewError.message : "โหลดข้อมูลตัวอย่างไม่สำเร็จ" });
        setShowValues(false);
      },
    );
    return () => { isCurrent = false; };
  }, [kind, propertyId]);

  const missingRecommended = recommendedPlaceholders[kind].filter((key) => !usedKeys.has(key));

  const save = async () => {
    setError("");
    // ข้อมูลสำคัญหายไปก็ยังบันทึกได้ (บางหอจัดรูปแบบเอง) แต่ต้องถามก่อน กันเผลอลบป้ายทิ้ง
    if (missingRecommended.length > 0 && !await confirm({
      title: "แบบฟอร์มยังไม่มีข้อมูลสำคัญบางช่อง",
      description: `ยังไม่มี ${missingRecommended.map((key) => labels[key]).join(", ")} ในเอกสาร ต้องการบันทึกต่อหรือไม่`,
      confirmLabel: "บันทึกต่อ",
    })) return;
    setIsSaving(true);
    try {
      // PUT เพราะส่ง HTML ทั้งก้อนไปแทนที่ของเดิม ไม่ได้แก้เฉพาะบางส่วน
      // ฝั่งเซิร์ฟเวอร์ต้องล้าง HTML ก่อนเก็บอยู่แล้ว ตรงนี้จึงส่งไปตามที่ผู้ใช้แก้
      const response = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, html: editorHtml() }) });
      const result = await response.json() as { error?: string; template?: DocumentTemplateDto };
      if (!response.ok || !result.template) throw new Error(result.error || "บันทึกแบบฟอร์มไม่สำเร็จ");
      onSaved(result.template);
      setIsContentDirty(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกแบบฟอร์มไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const previewPdf = async () => {
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
      if (!draftResponse.ok || !draftResult.template) throw new Error(draftResult.error || "บันทึกก่อนดูตัวอย่างไม่สำเร็จ");
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

  // เอาแบบฟอร์มมาตรฐานมาวางแทนในตัวแก้ไข พร้อมชื่อมาตรฐาน ชื่อเก่าอาจอ้างถึงหอหรือเนื้อหาที่ไม่มีแล้ว ยังไม่บันทึกจนกว่าจะกดบันทึก จึงยกเลิกได้ด้วยการออกโดยไม่บันทึก
  const resetToStandard = async () => {
    if (!await confirm({
      title: "คืนค่าแบบฟอร์มมาตรฐาน?",
      description: "เนื้อหาและชื่อแบบฟอร์มจะถูกแทนด้วยแบบมาตรฐานของระบบ แบบที่บันทึกไว้ยังไม่หายจนกว่าจะกดบันทึก และกดเลิกทำเพื่อย้อนกลับได้",
      confirmLabel: "คืนค่ามาตรฐาน",
      variant: "danger",
    })) return;
    setError("");
    pushHistory();
    loadIntoEditor(defaultTemplates[kind].html);
    setName(defaultTemplates[kind].name);
  };

  const keepEditorSelection = (event: React.MouseEvent) => event.preventDefault();

  const insertItems = [
    { id: "table", icon: <Table2 size={16} />, label: "ตาราง...", onSelect: () => setIsTableDialogOpen(true) },
    { id: "image", icon: <ImagePlus size={16} />, label: "รูปภาพ (ไม่เกิน 1 MB)", onSelect: () => imageInputRef.current?.click() },
    { id: "page-break", icon: <FilePlus2 size={16} />, label: "ขึ้นหน้าใหม่", onSelect: insertPageBreak },
    ...(kind === "contract" ? [{ id: "clauses", icon: <ScrollText size={16} />, label: "ข้อสัญญาสำเร็จรูป...", onSelect: () => setIsClauseDialogOpen(true) }] : []),
    { id: "signature", icon: <PenLine size={16} />, label: "บล็อกลายเซ็น", onSelect: () => insertBlock(snippetFragment(signatureBlockHtml(kind), labels)) },
  ];

  const pageItems = [
    { id: "merge", icon: <Minus size={16} />, label: "รวมกับหน้าก่อน", onSelect: mergeWithPreviousPage },
    { id: "delete", icon: <Trash2 size={16} />, label: "ลบหน้าปัจจุบัน", onSelect: deleteCurrentPage, variant: "danger" as const },
  ];

  const toolbar = (
    <div className="template-editor-toolbar" aria-label="เครื่องมือจัดรูปแบบ" onKeyDown={handleToolbarKeyDown} ref={toolbarRef} role="toolbar">
      <div className="template-toolbar-group">
        <IconButton label="หัวข้อ" onClick={insertHeading} onMouseDown={keepEditorSelection}><Heading2 size={16} /></IconButton>
        <IconButton aria-pressed={activeFormats.bold} className={activeFormats.bold ? "active" : ""} label="ตัวหนา" onClick={() => toggleInlineFormat("strong")} onMouseDown={keepEditorSelection}><Bold size={16} /></IconButton>
        <IconButton aria-pressed={activeFormats.italic} className={activeFormats.italic ? "active" : ""} label="ตัวเอียง" onClick={() => toggleInlineFormat("em")} onMouseDown={keepEditorSelection}><Italic size={16} /></IconButton>
        <IconButton aria-pressed={activeFormats.underline} className={activeFormats.underline ? "active" : ""} label="ขีดเส้นใต้" onClick={() => toggleInlineFormat("u")} onMouseDown={keepEditorSelection}><Underline size={16} /></IconButton>
      </div>
      <div className="template-toolbar-group template-font-controls">
        <DropdownField
          ariaLabel="ฟอนต์"
          onChange={(value) => wrapSelection("span", undefined, { fontFamily: value })}
          options={documentFontOptions.map((option) => ({ ...option }))}
          value={documentFontOptions.some((option) => option.value === activeFormats.fontFamily) ? activeFormats.fontFamily : "Sarabun"}
        />
        <DropdownField
          ariaLabel="ขนาดตัวอักษร"
          onChange={(value) => wrapSelection("span", undefined, { fontSize: `${value}px` })}
          options={fontSizes.map((size) => ({ value: String(size), label: String(size) }))}
          value={fontSizes.includes(Number(activeFormats.fontSize)) ? activeFormats.fontSize : "14"}
        />
        <label className="template-color-control" title="สีตัวอักษร"><span aria-hidden="true">A</span><input aria-label="สีตัวอักษร" defaultValue="#171717" onMouseDown={rememberSelection} onChange={(event) => wrapSelection("span", undefined, { color: event.target.value })} type="color" /></label>
        <label className="template-color-control highlight" title="สีไฮไลต์"><span aria-hidden="true">ไฮไลต์</span><input aria-label="สีไฮไลต์ข้อความ" defaultValue="#fff2a8" onMouseDown={rememberSelection} onChange={(event) => wrapSelection("span", undefined, { backgroundColor: event.target.value })} type="color" /></label>
      </div>
      <div className="template-toolbar-group">
        <IconButton aria-pressed={activeFormats.alignment === "text-left"} className={activeFormats.alignment === "text-left" ? "active" : ""} label="ชิดซ้าย" onClick={() => applyAlignment("text-left")} onMouseDown={keepEditorSelection}><AlignLeft size={16} /></IconButton>
        <IconButton aria-pressed={activeFormats.alignment === "text-center"} className={activeFormats.alignment === "text-center" ? "active" : ""} label="กึ่งกลาง" onClick={() => applyAlignment("text-center")} onMouseDown={keepEditorSelection}><AlignCenter size={16} /></IconButton>
        <IconButton aria-pressed={activeFormats.alignment === "text-right"} className={activeFormats.alignment === "text-right" ? "active" : ""} label="ชิดขวา" onClick={() => applyAlignment("text-right")} onMouseDown={keepEditorSelection}><AlignRight size={16} /></IconButton>
        <IconButton label="รายการหัวข้อ" onClick={insertList} onMouseDown={keepEditorSelection}><List size={16} /></IconButton>
      </div>
      <div className="template-toolbar-group">
        <ActionMenu align="start" items={insertItems} label="แทรก" trigger={<><Plus aria-hidden="true" size={16} /> แทรก <ChevronDown aria-hidden="true" size={14} /></>} />
        <ActionMenu align="start" items={pageItems} label="จัดการหน้า" trigger={<><FileText aria-hidden="true" size={16} /> หน้า <ChevronDown aria-hidden="true" size={14} /></>} />
      </div>
      <div className="template-toolbar-group template-history-controls">
        <IconButton disabled={historySize.undo === 0} label="เลิกทำ (Ctrl+Z)" onClick={() => stepHistory("undo")} onMouseDown={keepEditorSelection}><Undo2 size={16} /></IconButton>
        <IconButton disabled={historySize.redo === 0} label="ทำซ้ำ (Ctrl+Shift+Z)" onClick={() => stepHistory("redo")} onMouseDown={keepEditorSelection}><Redo2 size={16} /></IconButton>
      </div>
    </div>
  );

  return (
    <main className="document-editor-screen">
      <style>{editorFontCss}{getDocumentContentCss(".document-editor-paper")}</style>
      <div className="document-editor-top">
        <header className="document-editor-header">
          <button className="secondary-button document-editor-back" onClick={requestClose} type="button"><ArrowLeft aria-hidden="true" size={17} /> กลับหน้าตั้งค่า</button>
          <div className="document-editor-title"><small>แบบฟอร์มเอกสาร</small><h1>{templateTitles[kind].editor}</h1></div>
          <div className="document-editor-header-actions">
            <span className={`document-editor-save-state${isDirty ? " is-dirty" : ""}`} role="status">{isDirty ? "ยังไม่ได้บันทึก" : `บันทึกแล้ว · เวอร์ชัน ${template.version}`}</span>
            <button className="secondary-button" disabled={isPreviewing || isSaving} onClick={() => void previewPdf()} type="button"><Eye size={17} /> {isPreviewing ? "กำลังสร้าง..." : "ดู PDF"}</button>
            <button aria-describedby={!isSaving && !name.trim() ? "document-name-disabled-reason" : undefined} className="primary-button" disabled={isSaving || !name.trim()} onClick={() => void save()} type="button"><Save size={17} /> {isSaving ? "กำลังบันทึก..." : "บันทึก"}</button>
          </div>
        </header>
        {toolbar}
        {activeFormats.inTable ? <div aria-label="แก้ไขตาราง" className="template-table-actions" role="group">
          <span>ตาราง</span>
          <button onClick={() => editTable("add-row")} onMouseDown={keepEditorSelection} type="button"><Plus size={14} /> เพิ่มแถว</button>
          <button className="destructive-action" onClick={() => void confirmTableDeletion("remove-row")} onMouseDown={keepEditorSelection} type="button"><Minus size={14} /> ลบแถว</button>
          <button onClick={() => editTable("add-column")} onMouseDown={keepEditorSelection} type="button"><Plus size={14} /> เพิ่มคอลัมน์</button>
          <button className="destructive-action" onClick={() => void confirmTableDeletion("remove-column")} onMouseDown={keepEditorSelection} type="button"><Minus size={14} /> ลบคอลัมน์</button>
        </div> : null}
        {error ? <div className="document-editor-error" role="alert"><TriangleAlert aria-hidden="true" size={16} /><span>{error}</span><IconButton label="ปิดข้อความ" onClick={() => setError("")}><X size={14} /></IconButton></div> : null}
      </div>
      {/* อยู่นอกแถบเครื่องมือ ปุ่มลูกศรกับ End จะได้ไม่ไปหยุดที่ช่องเลือกไฟล์ที่มองไม่เห็น */}
      <input
        accept="image/png,image/jpeg,image/webp"
        className="template-image-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) insertImage(file);
          event.target.value = "";
        }}
        ref={imageInputRef}
        tabIndex={-1}
        type="file"
      />
      {!isSaving && !name.trim() ? <p className="disabled-reason document-editor-disabled-reason" id="document-name-disabled-reason">กรอกชื่อแบบฟอร์มก่อนบันทึก</p> : null}
      <div className="document-editor-workspace">
        {/* ปุ่มซูมลอยอยู่มุมล่างของพื้นที่กระดาษ แบบโปรแกรมเอกสารทั่วไป แถบเครื่องมือจะได้เหลือที่ให้คำสั่งแก้เอกสาร */}
        <div className="document-editor-stage">
          <div aria-label="มุมมอง" className="template-zoom-controls" role="group">
            <IconButton disabled={zoomOutTarget === undefined} label="ย่อมุมมอง" onClick={() => { if (zoomOutTarget !== undefined) setZoomMode(zoomOutTarget); }}><ZoomOut size={16} /></IconButton>
            <button aria-label={`มุมมอง ${zoomPercent}% กดเพื่อปรับให้พอดีความกว้าง`} aria-pressed={zoomMode === "fit"} className="template-zoom-fit" onClick={() => setZoomMode("fit")} type="button">
              {zoomMode === "fit" ? "พอดีจอ" : `${zoomPercent}%`}
            </button>
            <IconButton disabled={zoomInTarget === undefined} label="ขยายมุมมอง" onClick={() => { if (zoomInTarget !== undefined) setZoomMode(zoomInTarget); }}><ZoomIn size={16} /></IconButton>
          </div>
        <section className="document-editor-canvas" aria-label="พื้นที่กระดาษ A4" ref={canvasRef}>
          {/* ใช้ CSS zoom ไม่ใช่ transform เพราะ zoom ย่อพื้นที่ที่กระดาษกินด้วย กรอบจะไม่มีที่ว่างหรือแถบเลื่อนเกิน */}
          <div className="document-editor-paper-scale" style={{ zoom: zoomPercent / 100 }}>
            <div
              aria-label="เนื้อหาแบบฟอร์ม"
              className="template-rich-editor document-editor-paper"
              contentEditable
              onBeforeInput={(event) => {
                // คำสั่งเลิกทำจากเมนูของเบราว์เซอร์ใช้ประวัติของเราแทน ไม่งั้นสองประวัติจะตีกัน
                const inputType = (event.nativeEvent as InputEvent).inputType;
                if (inputType === "historyUndo" || inputType === "historyRedo") {
                  event.preventDefault();
                  stepHistory(inputType === "historyUndo" ? "undo" : "redo");
                  return;
                }
                pushTypingHistory();
                rememberPaginationPosition();
                rememberSelection();
              }}
              onBlur={() => window.setTimeout(() => setAutocomplete(null), 150)}
              onInput={() => {
                if (!paginationScrollRef.current || paginationScrollRef.current.validUntil <= Date.now()) {
                  rememberPaginationPosition();
                } else {
                  paginationScrollRef.current.validUntil = Date.now() + 1_500;
                }
                rememberSelection();
                updateAutocomplete();
                window.requestAnimationFrame(paginateEditor);
              }}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={rememberSelection}
              onMouseUp={rememberSelection}
              ref={editorRef}
              aria-multiline="true"
              role="textbox"
              suppressContentEditableWarning
              // contentEditable โฟกัสได้เองอยู่แล้ว ใส่ไว้ให้ชัดว่าเป็นตัวรับโฟกัสจริง ไม่ใช่กล่องเปล่า
              tabIndex={0}
            />
          </div>
        </section>
        </div>
        <aside className="document-editor-sidebar" aria-label="ตั้งค่าแบบฟอร์ม">
          <label className="form-field"><span>ชื่อแบบฟอร์ม</span><input maxLength={120} onChange={(event) => setName(event.target.value)} value={name} /></label>

          <section className="document-editor-variables">
            <header>
              <h2>ข้อมูลจากระบบ</h2>
              <button aria-pressed={showValues} className="document-editor-switch" disabled={preview.status !== "ready"} onClick={() => setShowValues((current) => !current)} type="button">
                <span aria-hidden="true" /> แสดงข้อมูลจริง
              </button>
            </header>
            <p>คลิกเพื่อแทรกตรงเคอร์เซอร์ หรือพิมพ์ <kbd>@</kbd> ในเอกสารเพื่อค้นหา</p>
            {preview.status === "ready" ? <p className="document-editor-preview-source">ตัวอย่างจาก{preview.label}</p> : null}
            {preview.status === "failed" ? <p className="document-editor-preview-source is-error">{preview.error}</p> : null}
            <div className="template-placeholder-list">
              {Object.entries(labels).map(([key, label]) => (
                <button key={key} onClick={() => insertPlaceholder(key)} onMouseDown={keepEditorSelection} type="button">
                  <span>{label}</span>
                  {preview.values?.[key] ? <small>{preview.values[key]}</small> : null}
                </button>
              ))}
            </div>
          </section>

          <section className="document-editor-checklist">
            <h2>ตรวจความครบถ้วน</h2>
            <ul>
              {recommendedPlaceholders[kind].map((key) => {
                const isUsed = usedKeys.has(key);
                return <li className={isUsed ? "is-done" : "is-missing"} key={key}>
                  {isUsed ? <Check aria-hidden="true" size={15} /> : <TriangleAlert aria-hidden="true" size={15} />}
                  <span>{labels[key]}</span>
                  <small>{isUsed ? "มีแล้ว" : "ยังไม่มี"}</small>
                  {isUsed ? null : <button onClick={() => insertPlaceholder(key)} onMouseDown={keepEditorSelection} type="button">แทรก</button>}
                </li>;
              })}
            </ul>
          </section>

          <button className="secondary-button document-editor-reset" onClick={() => void resetToStandard()} type="button"><RotateCcw aria-hidden="true" size={16} /> คืนค่าแบบฟอร์มมาตรฐาน</button>
        </aside>
      </div>

      {autocomplete && autocompleteOptions.length > 0 ? (
        <div aria-label="แทรกข้อมูลจากระบบ" className="template-autocomplete" role="listbox" style={{ left: autocomplete.left, top: autocomplete.top }}>
          {autocompleteOptions.map(([key, label], index) => (
            <button
              aria-selected={index === autocomplete.index}
              className={index === autocomplete.index ? "is-active" : undefined}
              key={key}
              onClick={() => chooseAutocomplete(key)}
              onMouseDown={keepEditorSelection}
              role="option"
              type="button"
            >
              <span>{label}</span>
              {preview.values?.[key] ? <small>{preview.values[key]}</small> : null}
            </button>
          ))}
        </div>
      ) : null}

      {isTableDialogOpen ? (
        <Dialog ariaDescribedBy="template-table-description" ariaLabelledBy="template-table-title" className="modal-sm" onClose={() => setIsTableDialogOpen(false)}>
          <form className="modal-form" onSubmit={(event) => { event.preventDefault(); insertTable(); }}>
            <header className="modal-header"><div><h2 id="template-table-title">แทรกตาราง</h2><p id="template-table-description">เพิ่มหรือลบแถวทีหลังได้ โดยคลิกในตารางแล้วใช้แถบตารางด้านบน</p></div><IconButton label="ปิด" onClick={() => setIsTableDialogOpen(false)}><X /></IconButton></header>
            <div className="modal-grid">
              <label><span>จำนวนแถว</span><input max={12} min={1} onChange={(event) => setTableRows(Number(event.target.value))} required type="number" value={tableRows} /></label>
              <label><span>จำนวนคอลัมน์</span><input max={8} min={1} onChange={(event) => setTableColumns(Number(event.target.value))} required type="number" value={tableColumns} /></label>
            </div>
            <footer className="modal-actions"><button onClick={() => setIsTableDialogOpen(false)} type="button">ยกเลิก</button><button type="submit">แทรกตาราง</button></footer>
          </form>
        </Dialog>
      ) : null}

      {isClauseDialogOpen ? (
        <Dialog ariaDescribedBy="template-clause-description" ariaLabelledBy="template-clause-title" className="modal-md" onClose={() => setIsClauseDialogOpen(false)}>
          <header className="modal-header"><div><h2 id="template-clause-title">ข้อสัญญาสำเร็จรูป</h2><p id="template-clause-description">เลือกข้อที่ต้องการ ระบบจะวางต่อจากย่อหน้าที่เคอร์เซอร์อยู่ แล้วแก้ข้อความต่อได้ตามต้องการ</p></div><IconButton label="ปิด" onClick={() => setIsClauseDialogOpen(false)}><X /></IconButton></header>
          <div className="template-clause-list">
            {contractClauses.map((snippet) => (
              <button key={snippet.id} onClick={() => insertSnippet(snippet)} type="button">
                <strong>{snippet.title}</strong>
                <span>{snippet.description}</span>
              </button>
            ))}
          </div>
        </Dialog>
      ) : null}

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
