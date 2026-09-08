/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/chat/attachments สำหรับระบบสนทนา
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";
import { sendAdminMessage } from "@/lib/server/chat";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";

export const runtime = "nodejs";

const fieldsSchema = z.object({
  tenantId: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  tenantName: z.string().trim().min(1).max(160),
  roomNumber: z.string().trim().min(1).max(30),
  body: z.string().trim().max(4000),
  clientId: z.string().uuid(),
});
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “detect File” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - bytes: ค่า “bytes” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function detectFile(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) return { extension: "png", mimeType: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", mimeType: "image/jpeg" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { extension: "webp", mimeType: "image/webp" };
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return { extension: "pdf", mimeType: "application/pdf" };
  return null;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request, null);
    const { auth, propertyId } = await requireRequestProperty(request);
    await assertUploadRateLimit(request, "chat");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "กรุณาเลือกไฟล์");
    if (file.size < 1 || file.size > MAX_FILE_SIZE) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");

    const input = fieldsSchema.parse({
      tenantId: formData.get("tenantId"),
      tenantName: formData.get("tenantName"),
      roomNumber: formData.get("roomNumber"),
      body: formData.get("body") ?? "",
      clientId: formData.get("clientId"),
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectFile(bytes);
    if (!detected) throw new ApiError(415, "รองรับเฉพาะ PNG, JPG, WebP และ PDF");

    const safeName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 255) || `ไฟล์.${detected.extension}`;
    const key = `chat/${propertyId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${detected.extension}`;
    await getStorageAdapter().put(key, Buffer.from(bytes), detected.mimeType);
    const message = await sendAdminMessage({
      propertyId,
      userId: auth.userId,
      ...input,
      attachment: { key, mimeType: detected.mimeType, name: safeName, size: file.size },
    });
    return apiSuccessResponse(request, { message }, { status: 201 }, {
      userId: auth.userId, propertyId, action: "CHAT_ATTACHMENT_SEND",
      targetType: "ChatMessage", targetId: message.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
