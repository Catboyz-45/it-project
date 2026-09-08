/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “chat.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { chatCursorSchema, sendChatMessageSchema } from "@/lib/domain/chat";

describe("chat validation", () => {
  it("rejects blank messages", () => {
    expect(sendChatMessageSchema.safeParse({ body: "  ", clientId: crypto.randomUUID() }).success).toBe(false);
  });

  it("caps page size", () => {
    expect(chatCursorSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
