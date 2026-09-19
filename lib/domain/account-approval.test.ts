import { describe, expect, it } from "vitest";
import { reviewAccountApprovalSchema } from "@/lib/domain/account-approval";

describe("account approval validation", () => {
  it("accepts approval without a rejection reason", () => {
    expect(reviewAccountApprovalSchema.parse({ status: "APPROVED" })).toEqual({ status: "APPROVED" });
  });

  it("requires a reason when rejecting an account", () => {
    expect(() => reviewAccountApprovalSchema.parse({ status: "REJECTED" })).toThrow();
    expect(reviewAccountApprovalSchema.parse({
      status: "REJECTED",
      rejectionReason: "ข้อมูลผู้สมัครไม่ครบถ้วน",
    })).toMatchObject({ status: "REJECTED" });
  });

  // ฟิลด์แปลกปลอมอย่าง isActive ต้องไม่ผ่าน ไม่งั้นจะเป็นช่องเปิดบัญชีข้ามขั้นตอนอนุมัติ
  it("rejects unknown fields and reasons attached to approval", () => {
    expect(() => reviewAccountApprovalSchema.parse({
      status: "APPROVED",
      rejectionReason: "not applicable",
    })).toThrow();
    expect(() => reviewAccountApprovalSchema.parse({ status: "APPROVED", isActive: true })).toThrow();
  });
});
