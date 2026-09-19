import { describe, expect, it } from "vitest";
import { createPromptPayPayload, paymentReviewSchema } from "@/lib/domain/payments";

describe("payments", () => {
  it("creates deterministic PromptPay payloads for phone and national IDs", () => {
    const phone = createPromptPayPayload("081-234-5678", 3500);
    // เบอร์ไทยต้องถูกแปลงเป็นรูปแบบสากล ตัด 0 หน้าแล้วเติมรหัสประเทศ 0066
    expect(phone).toContain("0066812345678");
    // ท้าย payload ต้องเป็น checksum ตามมาตรฐาน PromptPay ไม่งั้นแอปธนาคารสแกนไม่ผ่าน
    expect(phone).toMatch(/6304[0-9A-F]{4}$/);
    expect(createPromptPayPayload("1234567890123", 1)).toContain("1234567890123");
  });

  // ปฏิเสธต้องมีเหตุผลเสมอ เพราะผู้เช่าต้องรู้ว่าต้องแก้อะไรก่อนส่งหลักฐานใหม่
  it("requires a rejection reason", () => {
    expect(paymentReviewSchema.safeParse({ status: "REJECTED" }).success).toBe(false);
    expect(paymentReviewSchema.safeParse({ status: "REJECTED", rejectionNote: "ยอดไม่ตรง" }).success).toBe(true);
  });
});
