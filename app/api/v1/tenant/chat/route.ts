import { NextRequest, NextResponse } from "next/server";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { chatCursorSchema, sendChatMessageSchema } from "@/lib/domain/chat";
import { requireTenantChatActor } from "@/lib/server/chat-auth";
import { ensureTenantConversation, listConversationMessages, markConversationRead, sendConversationMessage } from "@/lib/server/chat";
import { getDatabase } from "@/lib/server/db";

async function resolveConversation(request: NextRequest) {
  const context = await requireTenantChatActor(request);
  const tenant = await getDatabase().tenantProfile.findUnique({
    where: { id: context.auth.tenantProfileId },
    select: { user: { select: { displayName: true } } },
  });
  const room = await getDatabase().room.findUnique({
    where: { id: context.occupancy.roomId },
    select: { number: true },
  });
  if (!tenant || !room) throw new Error("Active tenant references are invalid");
  const conversation = await ensureTenantConversation({
    propertyId: context.actor.propertyId,
    tenantProfileId: context.auth.tenantProfileId,
    tenantName: tenant.user.displayName,
    roomNumber: room.number,
  });
  return { ...context, conversation };
}

// ประวัติข้อความกับเจ้าของหอ
export async function GET(request: NextRequest) {
  try {
    const { actor, conversation } = await resolveConversation(request);
    const cursor = chatCursorSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listConversationMessages(conversation.id, actor, cursor);
    await markConversationRead(conversation.id, actor);
    return NextResponse.json({ conversationId: conversation.id, ...result });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

// ส่งข้อความหาเจ้าของหอ
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    await assertApiRateLimit(request, "chat");
    const { auth, actor, conversation } = await resolveConversation(request);
    const input = sendChatMessageSchema.parse(await request.json());
    const message = await sendConversationMessage({ conversationId: conversation.id, actor, ...input });
    return apiSuccessResponse(request, { message }, { status: 201 }, {
      userId: auth.userId,
      propertyId: actor.propertyId,
      action: "TENANT_CHAT_SEND",
      targetType: "ChatMessage",
      targetId: message.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
