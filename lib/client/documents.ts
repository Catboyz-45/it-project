"use client";

import { createApiError, readApiPayload, type ApiErrorPayload } from "@/lib/client/api-error";
import type { DocumentData } from "@/lib/documents/placeholders";
import type { DocumentKind } from "@/lib/documents/types";

// สร้างลิงก์แล้วสั่งคลิกเอง แทนการใช้ window.open
// เพราะหน้าต่างที่เปิดไว้ก่อนแล้วค่อยเปลี่ยนที่อยู่ทีหลัง จะไปยัง blob: URL ไม่ได้
// ใน Chromium มันจะค้างอยู่ที่ about:blank เงียบ ๆ โดยไม่แจ้งอะไรเลย
// ส่วนการคลิกลิงก์จริงใช้ได้แน่นอนทั้งกับ blob: และ URL ปกติ
function openInNewTab(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  // noopener กันหน้าที่เปิดใหม่เข้าถึงหน้าเดิมผ่าน window.opener
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// ดูตัวอย่างเอกสาร สร้างแล้วเปิดดูเลย ไม่ได้เก็บไฟล์ไว้
export async function previewDocumentPdf(propertyId: string, kind: DocumentKind, data: DocumentData): Promise<void> {
  const response = await fetch(`/api/documents/preview?propertyId=${encodeURIComponent(propertyId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, data }),
  });
  if (!response.ok) {
    // ตอบกลับมาไม่ใช่ JSON ก็ใช้ object ว่างแทน แล้วไปใช้ข้อความสำรอง
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    throw createApiError(payload, "ดูตัวอย่างเอกสารไม่สำเร็จ");
  }
  // แปลงไฟล์ที่ได้เป็น URL ในเครื่อง ไม่ต้องอัปโหลดขึ้นเซิร์ฟเวอร์ก่อน
  const blobUrl = URL.createObjectURL(await response.blob());
  openInNewTab(blobUrl);
  // คืนหน่วยความจำหลัง 2 นาที เผื่อเวลาให้แท็บใหม่โหลดไฟล์เสร็จก่อน
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
}

export async function generateDocumentPdf(
  propertyId: string,
  kind: DocumentKind,
  data: DocumentData,
): Promise<{ documentId: string; downloadUrl: string }> {
  const response = await fetch(`/api/documents?propertyId=${encodeURIComponent(propertyId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, data }),
  });
  // endpoint นี้ตอบ { documentId, downloadUrl, requestId } มาตรง ๆ
  // ไม่ได้ห่อไว้ใน data เหมือน route ใต้ /api/v1/* จึงใช้ readApiPayload ไม่ใช่ readApiData
  const result = await readApiPayload<ApiErrorPayload & { documentId: string; downloadUrl: string }>(
    response,
    "สร้างเอกสาร PDF ไม่สำเร็จ",
  );
  openInNewTab(result.downloadUrl);
  return result;
}
