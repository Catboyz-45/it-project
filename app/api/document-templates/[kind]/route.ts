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

function parseKind(value: string): DocumentKind {
  if (!documentKinds.includes(value as DocumentKind)) throw new ApiError(404, "ไม่พบประเภทเอกสาร");
  return value as DocumentKind;
}

// อ่าน Template เอกสารของหอ ไม่มีก็คืนของกลางที่มากับระบบ
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

// รีเซ็ต Template กลับเป็นของกลางที่มากับระบบ
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

// บันทึก Template ที่แก้แล้ว ล้าง HTML ก่อนเก็บเสมอ
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
