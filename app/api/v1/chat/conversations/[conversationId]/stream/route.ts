/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/chat/conversations/[conversationId]/stream สำหรับระบบสนทนา
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { parseChatId, requireChatActorForProperty } from "@/lib/server/chat-auth";
import { listConversationMessagesAfter } from "@/lib/server/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const cursorSchema = z.coerce.date();
const encoder = new TextEncoder();
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ conversationId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: Context) {
  const propertyId = request.nextUrl.searchParams.get("propertyId") ?? "";
  const actor = await requireChatActorForProperty(request, propertyId);
  const { conversationId: rawConversationId } = await context.params;
  const conversationId = parseChatId(rawConversationId);
  let cursor = cursorSchema.catch(new Date()).parse(
    request.nextUrl.searchParams.get("after") ?? new Date().toISOString(),
  );

  const stream = new ReadableStream<Uint8Array>({
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “start” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - controller: ค่า “controller” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async start(controller) {
      let closed = false;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close” ตามกฎของระบบ
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
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
