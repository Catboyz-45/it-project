import { NextRequest } from "next/server";
import { z } from "zod";
import { parseDocumentData } from "@/lib/documents/placeholders";
import { generateAndStoreDocument } from "@/lib/documents/service";
import { documentKinds, type DocumentKind } from "@/lib/documents/types";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({ kind: z.string(), data: z.unknown() }).strict();

// สร้างเอกสาร PDF แล้วเก็บไฟล์ไว้ พร้อมคืนลิงก์ดาวน์โหลด
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    await assertApiRateLimit(request, "document", "generate");
    const { auth, propertyId } = await requireRequestProperty(request);
    const input = requestSchema.parse(await request.json());
    if (!documentKinds.includes(input.kind as DocumentKind)) throw new ApiError(400, "ประเภทเอกสารไม่ถูกต้อง");
    const kind = input.kind as DocumentKind;
    const data = parseDocumentData(kind, input.data);
    const result = await generateAndStoreDocument(propertyId, kind, data);
    return apiSuccessResponse(request, result, { status: 201 }, {
      userId: auth.userId, propertyId, action: "DOCUMENT_GENERATE", targetType: "GeneratedDocument",
      targetId: "id" in result && typeof result.id === "string" ? result.id : undefined,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
