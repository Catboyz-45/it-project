import { describe, expect, it } from "vitest";
import { chatCursorSchema, sendChatMessageSchema } from "@/lib/domain/chat";

describe("chat validation", () => {
  // ข้อความที่มีแต่ช่องว่างต้องไม่ผ่าน ไม่งั้นห้องสนทนาจะเต็มไปด้วยข้อความเปล่า
  it("rejects blank messages", () => {
    expect(sendChatMessageSchema.safeParse({ body: "  ", clientId: crypto.randomUUID() }).success).toBe(false);
  });

  // จำกัดจำนวนต่อหน้า กันขอทีเดียวเยอะ ๆ จนเซิร์ฟเวอร์รับไม่ไหว
  it("caps page size", () => {
    expect(chatCursorSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
