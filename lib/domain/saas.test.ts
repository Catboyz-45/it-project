import { describe, expect, it } from "vitest";
import {
  assignSubscriptionSchema,
  createSaasPlanSchema,
  createSubscriptionOrderSchema,
  monthlyEquivalent,
  reviewSubscriptionPaymentSchema,
  startOfBangkokMonth,
  updateSaasPlanSchema,
  usagePercent,
} from "@/lib/domain/saas";

describe("SaaS plans", () => {
  // รหัสแพ็กเกจเก็บเป็นตัวพิมพ์ใหญ่เสมอ จะได้ไม่มี growth กับ GROWTH เป็นคนละอันในฐานข้อมูล
  it("normalizes plan codes", () => {
    expect(createSaasPlanSchema.parse({
      code: "growth", name: "Growth", monthlyPrice: 699,
      maxProperties: 3, maxRooms: 150,
    }).code).toBe("GROWTH");
  });

  it("fills feature defaults only when a plan is created", () => {
    expect(createSaasPlanSchema.parse({
      code: "basic", name: "Basic", monthlyPrice: 199, maxProperties: 1, maxRooms: 20,
    })).toMatchObject({ allowPromptPay: true, allowFileUploads: true, allowPrioritySupport: false, sortOrder: 0 });
  });

  // แก้แค่ชื่อต้องได้แค่ชื่อ ถ้าเติมค่าเริ่มต้นให้ด้วย ความสามารถที่ตั้งไว้ของแพ็กเกจจะถูกรีเซ็ตทิ้ง
  it("changes only the fields sent when a plan is edited", () => {
    expect(updateSaasPlanSchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
    expect(updateSaasPlanSchema.safeParse({}).success).toBe(false);
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

  // แปลงยอดรายปีเป็นต่อเดือนเพื่อเทียบกันได้ และใช้เกิน 100% ก็แสดงแค่ 100 ไม่ให้แถบล้น
  it("normalizes yearly revenue and caps usage", () => {
    expect(monthlyEquivalent(12000, "YEARLY")).toBe(1000);
    expect(usagePercent(35, 30)).toBe(100);
  });
});

describe("Bangkok month boundary", () => {
  // 00:30 วันที่ 1 ตามเวลาไทย ยังเป็นวันสุดท้ายของเดือนก่อนตาม UTC ต้องนับเป็นเดือนใหม่ตามเวลาไทย
  it("starts the month at midnight Thai time", () => {
    expect(startOfBangkokMonth(new Date("2026-10-31T17:30:00.000Z")).toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(startOfBangkokMonth(new Date("2026-10-15T05:00:00.000Z")).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(startOfBangkokMonth(new Date("2027-01-01T03:00:00.000Z")).toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });
});
