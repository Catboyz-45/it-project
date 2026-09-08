/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST, PUT ที่ URL /api/document-templates/[kind] สำหรับส่วนกลางของระบบ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultTemplates } from "@/lib/documents/default-templates";
import { getTemplate, saveTemplate } from "@/lib/documents/repository";
import { sanitizeTemplate, validateEmbeddedImages, validateTemplatePlaceholders } from "@/lib/documents/templates";
import { documentKinds, type DocumentKind } from "@/lib/documents/types";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";

export const runtime = "nodejs";

const templateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  html: z.string().trim().min(20).max(2_000_000),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Kind” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด DocumentKind ตามสัญญา TypeScript ของฟังก์ชัน
 */
function parseKind(value: string): DocumentKind {
  if (!documentKinds.includes(value as DocumentKind)) throw new ApiError(404, "ไม่พบประเภทเอกสาร");
  return value as DocumentKind;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    const { propertyId } = await requireRequestProperty(request);
    const kind = parseKind((await context.params).kind);
    const template = await getTemplate(propertyId, kind);
    return NextResponse.json({ template: template ? { html: template.html, kind, name: template.name, updatedAt: template.updatedAt.toISOString(), version: template.version } : null });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    assertSameOrigin(request);
    const { auth, propertyId } = await requireRequestProperty(request);
    const kind = parseKind((await context.params).kind);
    const existing = await getTemplate(propertyId, kind);
    const template = existing ?? await saveTemplate(propertyId, kind, defaultTemplates[kind].name, defaultTemplates[kind].html);
    return apiSuccessResponse(
      request,
      { template: { html: template.html, kind, name: template.name, updatedAt: template.updatedAt.toISOString(), version: template.version } },
      { status: existing ? 200 : 201 },
      { userId: auth.userId, propertyId, action: existing ? "DOCUMENT_TEMPLATE_READ_DEFAULT" : "DOCUMENT_TEMPLATE_CREATE", targetType: "DocumentTemplate", targetId: `${propertyId}:${kind}` },
    );
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแทนค่าข้อมูลทั้งชุดของ API เส้นทางนี้ โดยรักษากฎธุรกิจของระบบ
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    assertSameOrigin(request);
    const { auth, propertyId } = await requireRequestProperty(request);
    const kind = parseKind((await context.params).kind);
    const input = templateSchema.parse(await request.json());
    try {
      validateEmbeddedImages(input.html);
    } catch (imageError) {
      throw new ApiError(400, imageError instanceof Error ? imageError.message : "รูปภาพไม่ถูกต้อง");
    }
    const html = sanitizeTemplate(input.html);
    if (html.length < 20) throw new ApiError(400, "เนื้อหา template ว่างเปล่า");
    const unknown = validateTemplatePlaceholders(kind, html);
    if (unknown.length > 0) throw new ApiError(400, `ไม่รองรับตัวแปร: ${unknown.join(", ")}`);
    const template = await saveTemplate(propertyId, kind, input.name, html);
    return apiSuccessResponse(request, { template: { html: template.html, kind, name: template.name, updatedAt: template.updatedAt.toISOString(), version: template.version } }, undefined, {
      userId: auth.userId, propertyId, action: "DOCUMENT_TEMPLATE_UPDATE", targetType: "DocumentTemplate", targetId: `${propertyId}:${kind}`,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
