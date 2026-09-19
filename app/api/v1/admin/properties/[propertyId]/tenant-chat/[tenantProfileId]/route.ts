import { NextRequest, NextResponse } from "next/server";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { chatCursorSchema, sendChatMessageSchema } from "@/lib/domain/chat";
import { parseChatId, requireOwnerChatActor } from "@/lib/server/chat-auth";
import { ensureTenantConversation, listConversationMessages, markConversationRead, sendConversationMessage } from "@/lib/server/chat";
import { getDatabase } from "@/lib/server/db";
import { requireSubscriptionWriteAccess } from "@/lib/server/subscription-guard";

type Context = { params: Promise<{ propertyId: string; tenantProfileId: string }> };

async function resolve(request: NextRequest, context: Context) {
  const params = await context.params;
  const access = await requireOwnerChatActor(request, params.propertyId);
  const tenantProfileId = parseChatId(params.tenantProfileId);
  const occupancy = await getDatabase().roomOccupancy.findFirst({
    where: { propertyId: access.actor.propertyId, tenantProfileId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: {
      tenantProfile: { select: { user: { select: { displayName: true } } } },
      room: { select: { number: true } },
    },
  });
  if (!occupancy) return { ...access, conversation: null };
  const conversation = await ensureTenantConversation({
    propertyId: access.actor.propertyId,
    tenantProfileId,
    tenantName: occupancy.tenantProfile.user.displayName,
    roomNumber: occupancy.room.number,
  });
  return { ...access, conversation };
}

// ประวัติข้อความกับผู้เช่าคนหนึ่ง
export async function GET(request: NextRequest, context: Context) {
  try {
    const { actor, conversation } = await resolve(request, context);
    if (!conversation) throw new ApiError(404, "ไม่พบผู้เช่า");
    const cursor = chatCursorSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listConversationMessages(conversation.id, actor, cursor);
    await markConversationRead(conversation.id, actor);
    return NextResponse.json({ conversationId: conversation.id, ...result });
  } catch (error) { return apiErrorResponse(error, request); }
}

// ส่งข้อความหาผู้เช่า
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    await assertApiRateLimit(request, "chat");
    const { auth, actor, conversation } = await resolve(request, context);
    await requireSubscriptionWriteAccess(actor.propertyId);
    if (!conversation) throw new ApiError(404, "ไม่พบผู้เช่า");
    const input = sendChatMessageSchema.parse(await request.json());
    const message = await sendConversationMessage({ conversationId: conversation.id, actor, ...input });
    return apiSuccessResponse(request, { message }, { status: 201 }, { userId: auth.userId, propertyId: actor.propertyId, action: "OWNER_TENANT_CHAT_SEND", targetType: "ChatMessage", targetId: message.id });
  } catch (error) { return apiErrorResponse(error, request); }
}
