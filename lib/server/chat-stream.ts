import type { NextRequest } from "next/server";

const encoder = new TextEncoder();
const pollIntervalMs = 1000;

type StreamedMessage = { id: string; createdAt: string | Date };

// สร้างคำตอบแบบ Server-Sent Events ที่ถามข้อความใหม่ทุกวินาทีแล้วส่งต่อให้เบราว์เซอร์
// ใช้ร่วมกันทั้ง route แชตเดิมและ route ห้องสนทนา จะได้มีลูปและการปิดสตรีมชุดเดียว
// fetchAfter คือฟังก์ชันที่ดึงข้อความที่ใหม่กว่าเวลาที่ให้ไป ผู้เรียกตรวจสิทธิ์มาก่อนแล้ว
export function createMessageStreamResponse<T extends StreamedMessage>(
  request: NextRequest,
  initialCursor: Date,
  fetchAfter: (cursor: Date) => Promise<T[]>,
) {
  let cursor = initialCursor;
  // อยู่นอก start เพื่อให้ cancel() หยุดลูปได้ด้วย ตอนเบราว์เซอร์ปิดการเชื่อมต่อเอง
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* stream already closed */ }
      };
      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      while (!closed && !request.signal.aborted) {
        try {
          const messages = await fetchAfter(cursor);
          for (const message of messages) {
            controller.enqueue(encoder.encode(`id: ${message.id}\ndata: ${JSON.stringify(message)}\n\n`));
            cursor = new Date(message.createdAt);
          }
          if (messages.length === 0) controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          if (!closed) controller.enqueue(encoder.encode("event: error\ndata: {\"error\":\"stream unavailable\"}\n\n"));
          close();
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    },
    cancel() {
      // ผู้รับเลิกอ่านแล้ว หยุดดึงข้อมูลจากฐานข้อมูลทันที ไม่วนต่อไปเปล่า ๆ
      closed = true;
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
