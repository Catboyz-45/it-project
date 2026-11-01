import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { generatePdf } from "@/lib/documents/pdf";
import type { DocumentData } from "@/lib/documents/placeholders";
import { defaultTemplates } from "@/lib/documents/default-templates";
import { getTemplate, saveTemplate, toDatabaseKind } from "@/lib/documents/repository";
import { getStorageAdapter } from "@/lib/documents/storage";
import { renderTemplate, wrapPrintableHtml } from "@/lib/documents/templates";
import type { DocumentKind } from "@/lib/documents/types";
import { getDatabase } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";

// สร้าง PDF จาก Template ของหอนั้น ใช้ทั้งตอนดูตัวอย่างและตอนสร้างจริง
export async function renderDocumentPdf(propertyId: string, kind: DocumentKind, data: DocumentData) {
  // หอที่ยังไม่เคยเปิดหน้าแก้ Template จะยังไม่มีแถวของตัวเอง ใช้ของตั้งต้นแล้วบันทึกไว้ เหมือนตอนเปิดหน้าแก้
  // ไม่งั้นขอใบเสร็จครั้งแรกจะพังทั้งที่ระบบมี Template ตั้งต้นให้อยู่แล้ว
  const template = await getTemplate(propertyId, kind)
    ?? await saveTemplate(propertyId, kind, defaultTemplates[kind].name, defaultTemplates[kind].html);
  // แทนช่อง {{...}} ด้วยข้อมูลจริง แล้วห่อด้วย HTML ที่มีสไตล์สำหรับพิมพ์
  const body = renderTemplate(kind, template.html, data);
  const html = wrapPrintableHtml(body, `${template.name} ${data.reference_id}`);
  return { pdf: await generatePdf(html), template };
}

// สร้างแล้วเก็บไฟล์ไว้ด้วย ต่างจากดูตัวอย่างที่สร้างแล้วทิ้ง
export async function generateAndStoreDocument(propertyId: string, kind: DocumentKind, data: DocumentData) {
  const { pdf, template } = await renderDocumentPdf(propertyId, kind, data);
  const env = getServerEnv();
  const datePrefix = new Date().toISOString().slice(0, 10);
  // ชื่อไฟล์สุ่มจากฝั่งเซิร์ฟเวอร์ ไม่เอาชื่อที่ผู้ใช้กำหนด กันเดาที่อยู่ไฟล์ของคนอื่น
  // แบ่งโฟลเดอร์ตามวันเพื่อให้งานลบไฟล์เก่าตามระยะเก็บทำได้ง่าย
  const key = `${env.AWS_S3_PREFIX}/${kind}/${datePrefix}/${randomUUID()}.pdf`;
  await getStorageAdapter().put(key, pdf, "application/pdf");
  // เก็บ checksum ไว้ตรวจว่าไฟล์ที่ดาวน์โหลดมาเหมือนตอนสร้างจริง ไม่ถูกแก้ระหว่างทาง
  const checksum = createHash("sha256").update(pdf).digest("hex");
  const metadata = { roomNumber: data.room_number, tenantName: data.tenant_name, templateVersion: template.version } satisfies Prisma.InputJsonValue;
  const document = await getDatabase().generatedDocument.create({
    data: { propertyId, checksum, kind: toDatabaseKind(kind), metadata, referenceId: data.reference_id, sizeBytes: pdf.byteLength, storageKey: key, templateId: template.id },
    select: { id: true },
  });
  // คืนเป็น URL ของ API ที่ตรวจสิทธิ์ก่อน ไม่ใช่ที่อยู่ไฟล์จริงในที่เก็บ
  return { documentId: document.id, downloadUrl: `/api/documents/${document.id}/download` };
}
