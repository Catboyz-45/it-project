"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นตัวช่วยฝั่งเบราว์เซอร์สำหรับขอไฟล์ PDF ของสัญญา/บิลจาก API เอกสาร
 * การทำงาน: ขอไฟล์จาก API แล้วเปิดแท็บใหม่ไปที่ไฟล์นั้นผ่านการคลิกลิงก์ที่สร้างขึ้นชั่วคราว
 */

import { createApiError, readApiPayload, type ApiErrorPayload } from "@/lib/client/api-error";
import type { DocumentData } from "@/lib/documents/placeholders";
import type { DocumentKind } from "@/lib/documents/types";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปิดแท็บใหม่ไปที่ URL ที่กำหนด โดยจำลองการคลิกลิงก์แทนการสั่ง window.open/location.href โดยตรง
 * รับค่า:
 * - url: ที่อยู่ปลายทางที่จะเปิด
 * ผลลัพธ์: ไม่มีค่าคืน
 */
function openInNewTab(url: string): void {
  // A pre-opened window whose location is reassigned later cannot navigate
  // to a client-created blob: URL across the window boundary (it silently
  // stays on about:blank in Chromium) - clicking a real <a target="_blank">
  // does navigate reliably, for both blob: and normal server URLs.
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ขอตัวอย่าง PDF แบบไม่บันทึกไฟล์ แล้วเปิดแท็บใหม่แสดงผล
 * รับค่า:
 * - propertyId: หอพักที่เอกสารนี้เป็นของ
 * - kind: ประเภทเอกสาร (สัญญา/บิล)
 * - data: ข้อมูลที่จะแทนที่ placeholder ในแม่แบบ
 * ผลลัพธ์: ไม่มีค่าคืน; เปิดแท็บใหม่แสดง PDF เมื่อสำเร็จ
 */
export async function previewDocumentPdf(propertyId: string, kind: DocumentKind, data: DocumentData): Promise<void> {
  const response = await fetch(`/api/documents/preview?propertyId=${encodeURIComponent(propertyId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, data }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    throw createApiError(payload, "ดูตัวอย่างเอกสารไม่สำเร็จ");
  }
  const blobUrl = URL.createObjectURL(await response.blob());
  openInNewTab(blobUrl);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้าง PDF จริง บันทึกไฟล์ไว้ แล้วเปิดแท็บใหม่ไปดาวน์โหลด
 * รับค่า:
 * - propertyId: หอพักที่เอกสารนี้เป็นของ
 * - kind: ประเภทเอกสาร (สัญญา/บิล)
 * - data: ข้อมูลที่จะแทนที่ placeholder ในแม่แบบ
 * ผลลัพธ์: คืน id และลิงก์ดาวน์โหลดของเอกสารที่สร้าง
 */
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
  // This endpoint returns { documentId, downloadUrl, requestId } directly,
  // not wrapped in a `data` envelope, unlike the /api/v1/* routes.
  const result = await readApiPayload<ApiErrorPayload & { documentId: string; downloadUrl: string }>(
    response,
    "สร้างเอกสาร PDF ไม่สำเร็จ",
  );
  openInNewTab(result.downloadUrl);
  return result;
}
