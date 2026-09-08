/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/v1/chat/conversations/[conversationId]/attachments สำหรับระบบสนทนา
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { randomUUID } from "node:crypto";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { chatClientIdSchema, chatMessageBodySchema } from "@/lib/domain/chat";
import { getStorageAdapter } from "@/lib/documents/storage";
import { parseChatId, requireChatActorForProperty } from "@/lib/server/chat-auth";
import { sendConversationMessage } from "@/lib/server/chat";
import { requireSubscriptionFeature } from "@/lib/server/saas";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const fieldsSchema = z.object({
  propertyId: z.string().cuid(),
  body: chatMessageBodySchema,
  clientId: chatClientIdSchema,
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “detect File” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - bytes: ค่า “bytes” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function detectFile(bytes: Uint8Array) {
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length >= 8 && png.every((value, index) => bytes[index] === value)) return { extension: "png", mimeType: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", mimeType: "image/jpeg" };
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return { extension: "webp", mimeType: "image/webp" };
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return { extension: "pdf", mimeType: "application/pdf" };
  return null;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ conversationId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest, context: Context) {
  let storageKey: string | undefined;
  try {
    assertSameOrigin(request, null);
    const headerPropertyId = z.string().cuid().parse(request.headers.get("x-property-id"));
    const actor = await requireChatActorForProperty(request, headerPropertyId);
    await assertUploadRateLimit(request, "chat");
    const formData = await request.formData();
    const input = fieldsSchema.parse({
      propertyId: formData.get("propertyId"),
      body: formData.get("body") ?? "",
      clientId: formData.get("clientId"),
    });
    if (input.propertyId !== actor.propertyId) throw new ApiError(400, "ข้อมูลหอพักไม่ตรงกัน");
    await requireSubscriptionFeature(actor.propertyId, "allowFileUploads");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "กรุณาเลือกไฟล์");
    if (file.size < 1 || file.size > MAX_FILE_SIZE) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectFile(bytes);
    if (!detected) throw new ApiError(415, "รองรับเฉพาะ PNG, JPG, WebP และ PDF");
    const safeName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 255) || `file.${detected.extension}`;
    storageKey = `chat/${actor.propertyId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${detected.extension}`;
    await getStorageAdapter().put(storageKey, Buffer.from(bytes), detected.mimeType);
    const { conversationId } = await context.params;
    const message = await sendConversationMessage({
      conversationId: parseChatId(conversationId),
      actor,
      body: input.body,
      clientId: input.clientId,
      attachment: { key: storageKey, mimeType: detected.mimeType, name: safeName, size: file.size },
    });
    return apiSuccessResponse(request, { message }, { status: 201 }, {
      userId: actor.userId,
      propertyId: actor.propertyId,
      action: "CHAT_ATTACHMENT_SEND",
      targetType: "ChatMessage",
      targetId: message.id,
    });
  } catch (error) {
    if (storageKey) await getStorageAdapter().delete(storageKey).catch(() => undefined);
    return apiErrorResponse(error, request);
  }
}
