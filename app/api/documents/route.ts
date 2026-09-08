/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/documents สำหรับระบบเอกสาร
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

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
    return apiErrorResponse(error, request);
  }
}
