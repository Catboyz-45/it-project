/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “service”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { generatePdf } from "@/lib/documents/pdf";
import type { DocumentData } from "@/lib/documents/placeholders";
import { getTemplate, toDatabaseKind } from "@/lib/documents/repository";
import { getStorageAdapter } from "@/lib/documents/storage";
import { renderTemplate, wrapPrintableHtml } from "@/lib/documents/templates";
import type { DocumentKind } from "@/lib/documents/types";
import { getDatabase } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างผลลัพธ์สำหรับแสดงส่วน “render Document Pdf” บนหน้าจอ
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - data: ข้อมูลที่ฟังก์ชันนำไปประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function renderDocumentPdf(propertyId: string, kind: DocumentKind, data: DocumentData) {
  const template = await getTemplate(propertyId, kind);
  if (!template) throw new Error(`No active ${kind} template`);
  const body = renderTemplate(kind, template.html, data);
  const html = wrapPrintableHtml(body, `${template.name} ${data.reference_id}`);
  return { pdf: await generatePdf(html), template };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกอบหรือคำนวณผลลัพธ์ของ “generate And Store Document” จากข้อมูลที่ได้รับ
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - data: ข้อมูลที่ฟังก์ชันนำไปประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function generateAndStoreDocument(propertyId: string, kind: DocumentKind, data: DocumentData) {
  const { pdf, template } = await renderDocumentPdf(propertyId, kind, data);
  const env = getServerEnv();
  const datePrefix = new Date().toISOString().slice(0, 10);
  const key = `${env.AWS_S3_PREFIX}/${kind}/${datePrefix}/${randomUUID()}.pdf`;
  await getStorageAdapter().put(key, pdf, "application/pdf");
  const checksum = createHash("sha256").update(pdf).digest("hex");
  const metadata = { roomNumber: data.room_number, tenantName: data.tenant_name, templateVersion: template.version } satisfies Prisma.InputJsonValue;
  const document = await getDatabase().generatedDocument.create({
    data: { propertyId, checksum, kind: toDatabaseKind(kind), metadata, referenceId: data.reference_id, sizeBytes: pdf.byteLength, storageKey: key, templateId: template.id },
    select: { id: true },
  });
  return { documentId: document.id, downloadUrl: `/api/documents/${document.id}/download` };
}
