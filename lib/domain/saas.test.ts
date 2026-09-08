/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “saas.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import {
  assignSubscriptionSchema,
  createSaasPlanSchema,
  createSubscriptionOrderSchema,
  monthlyEquivalent,
  reviewSubscriptionPaymentSchema,
  usagePercent,
} from "@/lib/domain/saas";

describe("SaaS plans", () => {
  it("normalizes plan codes", () => {
    expect(createSaasPlanSchema.parse({
      code: "growth", name: "Growth", monthlyPrice: 699,
      maxProperties: 3, maxRooms: 150,
    }).code).toBe("GROWTH");
  });

  it("rejects an invalid subscription period", () => {
    expect(assignSubscriptionSchema.safeParse({
      planId: "plan_growth", startsAt: "2026-08-01", expiresAt: "2026-07-01",
    }).success).toBe(false);
  });

  it("validates self-service orders and requires a rejection reason", () => {
    expect(createSubscriptionOrderSchema.parse({
      planId: "plan_standard",
      billingInterval: "YEARLY",
    })).toMatchObject({ billingInterval: "YEARLY" });
    expect(reviewSubscriptionPaymentSchema.safeParse({
      status: "REJECTED",
    }).success).toBe(false);
    expect(reviewSubscriptionPaymentSchema.safeParse({
      status: "REJECTED",
      rejectionNote: "ยอดในสลิปไม่ตรง",
    }).success).toBe(true);
  });

  it("normalizes yearly revenue and caps usage", () => {
    expect(monthlyEquivalent(12000, "YEARLY")).toBe(1000);
    expect(usagePercent(35, 30)).toBe(100);
  });
});
