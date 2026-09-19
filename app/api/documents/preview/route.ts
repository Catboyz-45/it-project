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

// สร้าง PDF ไว้ดูตัวอย่าง ไม่ได้เก็บไฟล์
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
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
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
