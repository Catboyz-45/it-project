import { NextRequest } from "next/server";
import { z } from "zod";
import { parseChatId, requireChatActorForProperty } from "@/lib/server/chat-auth";
import { listConversationMessagesAfter } from "@/lib/server/chat";
import { createMessageStreamResponse } from "@/lib/server/chat-stream";
import { apiErrorResponse } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const cursorSchema = z.coerce.date();
type Context = { params: Promise<{ conversationId: string }> };

// สตรีมข้อความใหม่ในห้องสนทนา ส่งทางเดียวจากเซิร์ฟเวอร์ เบากว่าให้เบราว์เซอร์ถามซ้ำ ๆ
export async function GET(request: NextRequest, context: Context) {
  let actor: Awaited<ReturnType<typeof requireChatActorForProperty>>;
  let conversationId: string;
  try {
    const propertyId = request.nextUrl.searchParams.get("propertyId") ?? "";
    actor = await requireChatActorForProperty(request, propertyId);
    conversationId = parseChatId((await context.params).conversationId);
  } catch (error) {
    // ไม่ผ่านด่านตรวจสิทธิ์หรือ id ผิดรูปแบบ ต้องตอบเป็น 4xx ตามปกติ ไม่ใช่ปล่อย error หลุดจนกลายเป็น 500
    return apiErrorResponse(error, request);
  }
  const cursor = cursorSchema.catch(new Date()).parse(
    request.nextUrl.searchParams.get("after") ?? new Date().toISOString(),
  );
  return createMessageStreamResponse(request, cursor, (after) => listConversationMessagesAfter(conversationId, actor, after));
}
