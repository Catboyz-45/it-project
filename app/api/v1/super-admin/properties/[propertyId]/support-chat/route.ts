import { NextRequest, NextResponse } from "next/server";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { chatCursorSchema, sendChatMessageSchema } from "@/lib/domain/chat";
import { requireSuperAdminChatActor } from "@/lib/server/chat-auth";
import { ensureSupportConversation, listConversationMessages, markConversationRead, sendConversationMessage } from "@/lib/server/chat";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

async function resolve(request: NextRequest, context: Context) {
  const { propertyId } = await context.params;
  const access = await requireSuperAdminChatActor(request, propertyId);
  const conversation = await ensureSupportConversation(access.actor.propertyId);
  return { ...access, conversation };
}

// ประวัติข้อความช่วยเหลือกับหอหนึ่ง
export async function GET(request: NextRequest, context: Context) {
  try {
    const { actor, conversation } = await resolve(request, context);
    const cursor = chatCursorSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listConversationMessages(conversation.id, actor, cursor);
    await markConversationRead(conversation.id, actor);
    return NextResponse.json({ conversationId: conversation.id, ...result });
  } catch (error) { return apiErrorResponse(error, request); }
}

// ตอบข้อความช่วยเหลือให้เจ้าของหอ
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
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
