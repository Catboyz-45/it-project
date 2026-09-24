"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TemplateEditor } from "@/components/dorm/DocumentTemplatePanel";
import { RetryButton } from "@/components/ui/DataNavigation";
import type { DocumentKind, DocumentTemplateDto } from "@/lib/documents/types";

// ห่อหน้าแก้ไข Template ไว้ โหลดข้อมูลก่อนแล้วค่อยส่งต่อให้ตัวแก้ไขจริง
export function DocumentTemplateEditorRoute({ kind, propertyId }: Readonly<{ kind: DocumentKind; propertyId: string }>) {
  const router = useRouter();
  const [template, setTemplate] = useState<DocumentTemplateDto | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // useCallback เพราะ effect ข้างล่างใช้ตัวนี้เป็น dependency ถ้าไม่ห่อจะโหลดวนไม่จบ
  const loadTemplate = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      // no-store เพราะเพิ่งบันทึกเสร็จแล้วกลับมาดู ต้องได้ของใหม่ ไม่ใช่ของใน cache
      // encodeURIComponent กัน propertyId มีอักขระพิเศษแล้วทำ URL เพี้ยน
      const response = await fetch(`/api/document-templates/${kind}?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; template?: DocumentTemplateDto };
      // เช็คทั้งสถานะและตัวข้อมูล เพราะตอบ 200 แต่ไม่มี template ก็ใช้งานต่อไม่ได้อยู่ดี
      if (!response.ok || !result.template) throw new Error(result.error || "โหลด Template ไม่สำเร็จ");
      setTemplate(result.template);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลด Template ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [kind, propertyId]);

  // void บอกว่าตั้งใจไม่รอผล เพราะ effect คืน Promise ไม่ได้
  useEffect(() => { void loadTemplate(); }, [loadTemplate]);

  // แยกสามสถานะให้ชัด กำลังโหลด โหลดพลาด และพร้อมใช้งาน
  if (isLoading) return <main className="document-editor-state"><strong>กำลังโหลด Template...</strong></main>;
  if (error || !template) {
    return <main className="document-editor-state"><strong>เปิดหน้าแก้ไขไม่สำเร็จ</strong><p>{error}</p><RetryButton onClick={() => void loadTemplate()} /></main>;
  }

  // ปิดแล้วกลับไปหน้าหอพัก ส่วน onSaved อัปเดตข้อมูลในมือให้ตรงกับที่เพิ่งบันทึก
  return <TemplateEditor kind={kind} propertyId={propertyId} onClose={() => router.push(`/admin/properties/${propertyId}`)} onSaved={setTemplate} template={template} />;
}
