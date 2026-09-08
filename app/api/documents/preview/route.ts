/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/documents/preview สำหรับระบบเอกสาร
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { parseDocumentData } from "@/lib/documents/placeholders";
import { renderDocumentPdf } from "@/lib/documents/service";
import { documentKinds, type DocumentKind } from "@/lib/documents/types";
import { ApiError, apiErrorResponse, apiSuccessBinaryResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";
import { getDocumentPreviewData } from "@/lib/documents/preview-data";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({ kind: z.string(), data: z.unknown().optional() }).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await assertApiRateLimit(request, "document", "preview");
    // Rendering a transient preview does not persist or modify property data,
    // so it remains available while the property is in read-only mode.
    const { auth, propertyId } = await requireRequestProperty(request, { requireWriteAccess: false });
    const input = requestSchema.parse(await request.json());
    if (!documentKinds.includes(input.kind as DocumentKind)) throw new ApiError(400, "ประเภทเอกสารไม่ถูกต้อง");
    const kind = input.kind as DocumentKind;
    const data = input.data === undefined
      ? await getDocumentPreviewData(propertyId, kind)
      : parseDocumentData(kind, input.data);
    const { pdf } = await renderDocumentPdf(propertyId, kind, data);
    return apiSuccessBinaryResponse(
      request,
      new Uint8Array(pdf),
      { headers: { "Cache-Control": "private, no-store", "Content-Disposition": "inline; filename=preview.pdf", "Content-Type": "application/pdf", "X-Content-Type-Options": "nosniff" } },
      { userId: auth.userId, propertyId, action: "DOCUMENT_PREVIEW", targetType: "DocumentPreview", targetId: kind },
    );
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
