import { describe, expect, it } from "vitest";
import { createAnnouncementSchema, createTicketReplySchema, createTicketSchema, ticketTransitions } from "@/lib/domain/property-operations";

describe("property operations", () => {
  // เลือกขอบเขตแบบเจาะจงแล้วต้องระบุด้วยว่าห้องไหน ไม่งั้นประกาศจะไม่ถึงใครเลย
  it("requires the target that matches an announcement audience", () => {
    const base = { title: "ประกาศ", content: "รายละเอียด", audience: "ROOM" };
    expect(createAnnouncementSchema.safeParse(base).success).toBe(false);
    expect(createAnnouncementSchema.safeParse({ ...base, roomIds: ["cm12345678901234567890123"] }).success).toBe(true);
  });

  it("validates tenant-created ticket content", () => {
    expect(createTicketSchema.safeParse({ type: "REPAIR", title: "", detail: "" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ type: "COMPLAINT", title: "เสียงดัง", detail: "หลัง 22:00" }).success).toBe(true);
  });

  // ตัดช่องว่างหัวท้าย ไม่รับข้อความว่าง และจำกัดความยาวไม่เกิน 4000 ตัว
  it("trims and limits ticket replies", () => {
    expect(createTicketReplySchema.parse({ body: "  รับทราบครับ  " })).toEqual({ body: "รับทราบครับ" });
    expect(() => createTicketReplySchema.parse({ body: " " })).toThrow();
    expect(() => createTicketReplySchema.parse({ body: "x".repeat(4001) })).toThrow();
  });

  // ปิดเรื่องแล้วต้องไปต่อไม่ได้ ผู้เช่าต้องแจ้งเรื่องใหม่แทน จะได้ตามประวัติได้ชัด
  it("does not reopen resolved tickets", () => {
    expect(ticketTransitions.RESOLVED).toEqual([]);
  });
});
