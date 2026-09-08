/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “payments.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { createPromptPayPayload, paymentReviewSchema } from "@/lib/domain/payments";

describe("payments", () => {
  it("creates deterministic PromptPay payloads for phone and national IDs", () => {
    const phone = createPromptPayPayload("081-234-5678", 3500);
    expect(phone).toContain("0066812345678");
    expect(phone).toMatch(/6304[0-9A-F]{4}$/);
    expect(createPromptPayPayload("1234567890123", 1)).toContain("1234567890123");
  });

  it("requires a rejection reason", () => {
    expect(paymentReviewSchema.safeParse({ status: "REJECTED" }).success).toBe(false);
    expect(paymentReviewSchema.safeParse({ status: "REJECTED", rejectionNote: "ยอดไม่ตรง" }).success).toBe(true);
  });
});
