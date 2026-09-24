import { describe, expect, it } from "vitest";
import { createLeaseSchema, renewLeaseSchema, updateLeaseSchema } from "@/lib/domain/leases";
import { leaseStatusTransitions } from "@/lib/domain/enums";

describe("lease lifecycle", () => {
  it("rejects an end date before the start date", () => {
    expect(createLeaseSchema.safeParse({
      roomId: "cm12345678901234567890123",
      startDate: "2027-01-01",
      endDate: "2026-01-01",
      monthlyRent: 3000,
    }).success).toBe(false);
  });

  // แก้สัญญาต้องส่ง version มาด้วย เซิร์ฟเวอร์จะได้ปฏิเสธถ้ามีคนอื่นแก้ไปก่อนแล้ว
  it("requires optimistic version for edits", () => {
    expect(updateLeaseSchema.safeParse({ monthlyRent: 3500 }).success).toBe(false);
    expect(updateLeaseSchema.safeParse({ expectedVersion: 1, monthlyRent: 3500 }).success).toBe(true);
  });

  // ร่างข้ามไปใช้งานเลยไม่ได้ ต้องผ่านขั้นรอลงนามก่อน เพื่อให้มีจังหวะตรวจก่อนสัญญามีผล
  it("requires signature review before activation", () => {
    expect(leaseStatusTransitions.DRAFT).not.toContain("ACTIVE");
    expect(leaseStatusTransitions.PENDING_SIGNATURE).toContain("ACTIVE");
  });

  it("validates renewal dates and money", () => {
    expect(renewLeaseSchema.safeParse({ startDate: "2027-01-01", endDate: "2027-12-31", monthlyRent: 4000, depositAmount: 4000 }).success).toBe(true);
    expect(renewLeaseSchema.safeParse({ startDate: "2027-12-31", endDate: "2027-01-01", monthlyRent: 4000 }).success).toBe(false);
  });
});

// ทั้งโปรเจกต์ย้ายจาก z.string().cuid() ที่ถูก deprecate มาเป็น z.string().cuid()
// ตัวทดสอบนี้กันไม่ให้ใครเข้าใจผิดว่า cuid2 คือตัวแทน เพราะ cuid2 รับสตริงกว้างกว่า
// ถ้าเผลอเปลี่ยนไปใช้ cuid2 การตรวจ id จะหลวมลงทั้งระบบโดยไม่มีใครรู้
describe("lease id validation", () => {
  const lease = { startDate: "2026-01-01", endDate: "2027-01-01", monthlyRent: 3000 };

  it("accepts a real cuid room id", () => {
    expect(createLeaseSchema.safeParse({ ...lease, roomId: "cjld2cjxh0000qzrmn831i7rn" }).success).toBe(true);
  });

  it("rejects ids that are not cuids, including the wider cuid2 shape", () => {
    for (const bad of ["", "not-a-cuid", "tz4a98xxat96iws9zmbrgj3a"]) {
      expect(createLeaseSchema.safeParse({ ...lease, roomId: bad }).success).toBe(false);
    }
  });
});
