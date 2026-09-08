"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Document Template Editor Route” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TemplateEditor } from "@/components/dorm/DocumentTemplatePanel";
import { RetryButton } from "@/components/ui/DataNavigation";
import type { DocumentKind, DocumentTemplateDto } from "@/lib/documents/types";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Document Template Editor Route” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { kind, propertyId }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function DocumentTemplateEditorRoute({ kind, propertyId }: { kind: DocumentKind; propertyId: string }) {
  const router = useRouter();
  const [template, setTemplate] = useState<DocumentTemplateDto | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Template” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadTemplate = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; template?: DocumentTemplateDto };
      if (!response.ok || !result.template) throw new Error(result.error || "โหลด Template ไม่สำเร็จ");
      setTemplate(result.template);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลด Template ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [kind, propertyId]);

  useEffect(() => { void loadTemplate(); }, [loadTemplate]);

  if (isLoading) return <main className="document-editor-state"><strong>กำลังโหลด Template...</strong></main>;
  if (error || !template) {
    return <main className="document-editor-state"><strong>เปิดหน้าแก้ไขไม่สำเร็จ</strong><p>{error}</p><RetryButton onClick={() => void loadTemplate()} /></main>;
  }

  return <TemplateEditor kind={kind} propertyId={propertyId} onClose={() => router.push(`/admin/properties/${propertyId}`)} onSaved={setTemplate} template={template} />;
}
