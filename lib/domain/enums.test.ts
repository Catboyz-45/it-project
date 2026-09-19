import { describe, expect, it } from "vitest";
import {
  invoiceStatusSchema,
  invoiceStatusTransitions,
  leaseStatusTransitions,
  roomStatusSchema,
  ticketStatusTransitions,
} from "@/lib/domain/enums";

// สถานะทั้งระบบอ้างอิงจากที่เดียว ตัวทดสอบนี้กันไม่ให้ใครเผลอเปิดทางเปลี่ยนสถานะที่ไม่ควรเปลี่ยน
describe("domain enums", () => {
  it("accepts only canonical enum values", () => {
    expect(roomStatusSchema.parse("AVAILABLE")).toBe("AVAILABLE");
    expect(invoiceStatusSchema.safeParse("paid").success).toBe(false);
  });

  // สถานะปลายทางต้องไปต่อไม่ได้ ชำระแล้วหรือยกเลิกแล้วจะย้อนกลับมาแก้ไม่ได้อีก
  it("does not permit reopening terminal states", () => {
    expect(invoiceStatusTransitions.PAID).toEqual([]);
    expect(invoiceStatusTransitions.CANCELLED).toEqual([]);
    expect(leaseStatusTransitions.EXPIRED).toEqual([]);
    expect(ticketStatusTransitions.RESOLVED).toEqual([]);
  });
});
