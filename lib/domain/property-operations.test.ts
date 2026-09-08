/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “property operations.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { createAnnouncementSchema, createTicketReplySchema, createTicketSchema, ticketTransitions } from "@/lib/domain/property-operations";

describe("property operations", () => {
  it("requires the target that matches an announcement audience", () => {
    const base = { title: "ประกาศ", content: "รายละเอียด", audience: "ROOM" };
    expect(createAnnouncementSchema.safeParse(base).success).toBe(false);
    expect(createAnnouncementSchema.safeParse({ ...base, roomIds: ["cm12345678901234567890123"] }).success).toBe(true);
  });

  it("validates tenant-created ticket content", () => {
    expect(createTicketSchema.safeParse({ type: "REPAIR", title: "", detail: "" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ type: "COMPLAINT", title: "เสียงดัง", detail: "หลัง 22:00" }).success).toBe(true);
  });

  it("trims and limits ticket replies", () => {
    expect(createTicketReplySchema.parse({ body: "  รับทราบครับ  " })).toEqual({ body: "รับทราบครับ" });
    expect(() => createTicketReplySchema.parse({ body: " " })).toThrow();
    expect(() => createTicketReplySchema.parse({ body: "x".repeat(4001) })).toThrow();
  });

  it("does not reopen resolved tickets", () => {
    expect(ticketTransitions.RESOLVED).toEqual([]);
  });
});
