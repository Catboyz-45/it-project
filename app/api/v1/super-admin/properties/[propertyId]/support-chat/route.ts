/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/v1/super-admin/properties/[propertyId]/support-chat สำหรับผู้ดูแลแพลตฟอร์ม (Super Admin)
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { chatCursorSchema, sendChatMessageSchema } from "@/lib/domain/chat";
import { requireSuperAdminChatActor } from "@/lib/server/chat-auth";
import { ensureSupportConversation, listConversationMessages, markConversationRead, sendConversationMessage } from "@/lib/server/chat";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “resolve” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function resolve(request: NextRequest, context: Context) {
  const { propertyId } = await context.params;
  const access = await requireSuperAdminChatActor(request, propertyId);
  const conversation = await ensureSupportConversation(access.actor.propertyId);
  return { ...access, conversation };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { actor, conversation } = await resolve(request, context);
    const cursor = chatCursorSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listConversationMessages(conversation.id, actor, cursor);
    await markConversationRead(conversation.id, actor);
    return NextResponse.json({ conversationId: conversation.id, ...result });
  } catch (error) { return apiErrorResponse(error, request); }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    await assertApiRateLimit(request, "chat");
    const { auth, actor, conversation } = await resolve(request, context);
    const input = sendChatMessageSchema.parse(await request.json());
    const message = await sendConversationMessage({ conversationId: conversation.id, actor, ...input });
    return apiSuccessResponse(request, { message }, { status: 201 }, {
      userId: auth.userId, propertyId: actor.propertyId, action: "SUPER_ADMIN_SUPPORT_CHAT_SEND",
      targetType: "ChatMessage", targetId: message.id,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
