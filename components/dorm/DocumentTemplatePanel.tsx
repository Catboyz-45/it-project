"use client";
// การ์ดแบบฟอร์มเอกสารในหน้าตั้งค่า โหลดสถานะเอง และเปิดแท็บดูตัวอย่าง PDF

import { Eye, PenLine, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { templateTitles } from "@/components/dorm/document-editor/TemplateEditor";
import type { DocumentTemplateDto, DocumentKind } from "@/lib/documents/types";
import { RetryButton } from "@/components/ui/DataNavigation";

// การ์ดสรุปในหน้าตั้งค่า บอกว่ามี Template แล้วหรือยัง พร้อมปุ่มไปหน้าแก้ไข
// สถานะของโครงเอกสาร ใช้เลือกว่าจะแสดงอะไรในกรอบ
type TemplateStatus = "loading" | "missing" | "ready" | "failed";

function templateStatusOf({ error, isLoading, template }: {
  error: string;
  isLoading: boolean;
  template: DocumentTemplateDto | null;
}): TemplateStatus {
  if (template) return "ready";
  if (isLoading) return "loading";
  return error ? "failed" : "missing";
}

async function loadTemplateRequest(kind: DocumentKind, propertyId: string) {
  const response = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" });
  const result = await response.json() as { error?: string; template?: DocumentTemplateDto };
  if (!response.ok) throw new Error(result.error || "โหลดแบบฟอร์มไม่สำเร็จ");
  return result.template ?? null;
}

async function createTemplateRequest(kind: DocumentKind, propertyId: string) {
  const response = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const result = await response.json() as { error?: string; template?: DocumentTemplateDto };
  if (!response.ok || !result.template) throw new Error(result.error || "สร้างแบบฟอร์มไม่สำเร็จ");
  return result.template;
}

// เปิดแท็บใหม่ไว้ก่อนแล้วค่อยพาไปที่ไฟล์ เพราะเบราว์เซอร์บล็อกการเปิดแท็บหลัง await
async function previewTemplateRequest(kind: DocumentKind, propertyId: string) {
  const previewWindow = window.open("", "_blank");
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
    // คืนหน่วยความจำหลังผ่านไปสองนาที เผื่อผู้ใช้ยังเปิดดูอยู่
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (previewError) {
    previewWindow?.close();
    throw previewError;
  }
}

export function DocumentTemplatePanel({
  editable = false,
  kind,
  propertyId,
}: Readonly<{
  editable?: boolean;
  kind: DocumentKind;
  propertyId: string;
}>) {
  const router = useRouter();
  const [template, setTemplate] = useState<DocumentTemplateDto | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadTemplate = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setTemplate(await loadTemplateRequest(kind, propertyId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดแบบฟอร์มไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [kind, propertyId]);

  useEffect(() => { void loadTemplate(); }, [loadTemplate]);

  const createTemplate = async () => {
    setIsCreating(true);
    setError("");
    try {
      setTemplate(await createTemplateRequest(kind, propertyId));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "สร้างแบบฟอร์มไม่สำเร็จ");
    } finally {
      setIsCreating(false);
    }
  };

  const preview = async () => {
    setIsPreviewing(true);
    setError("");
    try {
      await previewTemplateRequest(kind, propertyId);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "สร้างตัวอย่างไม่สำเร็จ");
    } finally {
      setIsPreviewing(false);
    }
  };

  const title = templateTitles[kind].panel;
  const status = templateStatusOf({ error, isLoading, template });

  return <section className="panel template-panel settings-section">
    <div className="settings-section-head">
      <div><h2>{title}</h2><p>ปรับข้อความและรูปแบบของเอกสารที่ระบบสร้างให้ผู้เช่า</p></div>
      <small><TemplateVersionLabel isLoading={isLoading} template={template} /></small>
    </div>
    {error ? <div className="template-status warn" role="alert">{error}</div> : null}
    <TemplateBody
      editable={editable}
      isCreating={isCreating}
      isPreviewing={isPreviewing}
      kind={kind}
      onCreate={createTemplate}
      onOpenEditor={() => router.push(`/settings/documents/${kind}/edit?propertyId=${encodeURIComponent(propertyId)}`)}
      onPreview={preview}
      onRetry={loadTemplate}
      status={status}
      title={title}
    />
  </section>;
}

function TemplateVersionLabel({ isLoading, template }: Readonly<{ isLoading: boolean; template: DocumentTemplateDto | null }>) {
  if (template) return <>เวอร์ชัน {template.version}</>;
  return <>{isLoading ? "กำลังโหลด..." : "ยังไม่พร้อม"}</>;
}

// เนื้อในกรอบ ต่างกันตามว่ามีโครงเอกสารแล้วหรือยัง
function TemplateBody({ editable, isCreating, isPreviewing, onCreate, onOpenEditor, onPreview, onRetry, status, title }: Readonly<{
  editable: boolean;
  isCreating: boolean;
  isPreviewing: boolean;
  kind: DocumentKind;
  onCreate: () => Promise<void>;
  onOpenEditor: () => void;
  onPreview: () => Promise<void>;
  onRetry: () => Promise<void>;
  status: TemplateStatus;
  title: string;
}>) {
  if (status === "ready") return <TemplateActions editable={editable} isPreviewing={isPreviewing} onOpenEditor={onOpenEditor} onPreview={onPreview} />;
  if (status === "missing") return <TemplateMissingState editable={editable} isCreating={isCreating} onCreate={onCreate} title={title} />;
  if (status === "failed") return <RetryButton onClick={() => void onRetry()} />;
  return null;
}

// ปุ่มของโครงเอกสารที่มีอยู่แล้ว ดูตัวอย่างได้เสมอ ส่วนแก้ไขต้องมีสิทธิ์
function TemplateActions({ editable, isPreviewing, onOpenEditor, onPreview }: Readonly<{
  editable: boolean;
  isPreviewing: boolean;
  onOpenEditor: () => void;
  onPreview: () => Promise<void>;
}>) {
  return <div className="template-actions">
    <button className={editable ? "secondary-button" : "primary-button"} disabled={isPreviewing} onClick={() => void onPreview()} type="button">
      <Eye size={17} /> {isPreviewing ? "กำลังสร้างตัวอย่าง..." : "ดูตัวอย่าง PDF"}
    </button>
    {editable ? <button className="primary-button" onClick={onOpenEditor} type="button"><PenLine size={17} /> แก้ไขแบบฟอร์ม</button> : null}
  </div>;
}

// ยังไม่มีโครงเอกสาร คนที่มีสิทธิ์สร้างจากโครงมาตรฐานได้เลย
function TemplateMissingState({ editable, isCreating, onCreate, title }: Readonly<{
  editable: boolean;
  isCreating: boolean;
  onCreate: () => Promise<void>;
  title: string;
}>) {
  return <div className="empty-state">
    <div>
      <strong>หอนี้ยังไม่มี{title}</strong>
      <p>{editable ? "สร้างจากแบบฟอร์มมาตรฐาน แล้วจึงปรับข้อความและรูปแบบให้เหมาะกับหอพัก" : "ยังไม่มีแบบฟอร์มให้ดูตัวอย่าง"}</p>
      {editable ? <button className="primary-button" disabled={isCreating} onClick={() => void onCreate()} type="button">
        <Plus size={17} /> {isCreating ? "กำลังสร้าง..." : `สร้าง${title}`}
      </button> : null}
    </div>
  </div>;
}
