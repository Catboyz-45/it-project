import { NextRequest } from "next/server";
import { z } from "zod";
import { parseChatId, requireChatActorForProperty } from "@/lib/server/chat-auth";
import { listConversationMessagesAfter } from "@/lib/server/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const cursorSchema = z.coerce.date();
const encoder = new TextEncoder();
type Context = { params: Promise<{ conversationId: string }> };

// สตรีมข้อความใหม่ในห้องสนทนา ส่งทางเดียวจากเซิร์ฟเวอร์ เบากว่าให้เบราว์เซอร์ถามซ้ำ ๆ
export async function GET(request: NextRequest, context: Context) {
  const propertyId = request.nextUrl.searchParams.get("propertyId") ?? "";
  const actor = await requireChatActorForProperty(request, propertyId);
  const { conversationId: rawConversationId } = await context.params;
  const conversationId = parseChatId(rawConversationId);
  let cursor = cursorSchema.catch(new Date()).parse(
    request.nextUrl.searchParams.get("after") ?? new Date().toISOString(),
  );

  const stream = new ReadableStream<Uint8Array>({
  async start(controller) {
      let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      while (!closed && !request.signal.aborted) {
        try {
          const messages = await listConversationMessagesAfter(conversationId, actor, cursor);
          for (const message of messages) {
            controller.enqueue(encoder.encode(`id: ${message.id}\ndata: ${JSON.stringify(message)}\n\n`));
            cursor = new Date(message.createdAt);
          }
          if (messages.length === 0) controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          controller.enqueue(encoder.encode("event: error\ndata: {\"error\":\"stream unavailable\"}\n\n"));
          close();
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
