import { NextRequest } from "next/server";
import { z } from "zod";
import { listPropertyMessagesAfter } from "@/lib/server/chat";
import { requireRequestProperty } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const afterSchema = z.coerce.date();
const encoder = new TextEncoder();

// สตรีมข้อความใหม่แบบเรียลไทม์ของทางเดิม
export async function GET(request: NextRequest) {
  const { propertyId } = await requireRequestProperty(request);
  let cursor = afterSchema.catch(new Date()).parse(request.nextUrl.searchParams.get("after") ?? new Date().toISOString());
  const stream = new ReadableStream<Uint8Array>({
  async start(controller) {
      let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* stream already closed */ }
      };
      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      while (!closed && !request.signal.aborted) {
        try {
          const messages = await listPropertyMessagesAfter(propertyId, cursor);
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
  cancel() {
      // The request abort signal closes the producer loop.
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
