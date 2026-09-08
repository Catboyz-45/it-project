/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “subscription guard.test” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { describe, expect, it } from "vitest";
import {
  assertActiveSubscription,
  assertSubscriptionFeature,
  assertSubscriptionWriteAccess,
  getSubscriptionAccessState,
  type SubscriptionAccess,
} from "@/lib/server/subscription-guard";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “subscription” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - overrides: ค่า “overrides” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด SubscriptionAccess ตามสัญญา TypeScript ของฟังก์ชัน
 */
function subscription(
  overrides: Partial<SubscriptionAccess> = {},
): SubscriptionAccess {
  return {
    status: "ACTIVE",
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    maxProperties: 1,
    maxRooms: 100,
    plan: {
      allowPromptPay: true,
      allowFileUploads: false,
      allowPrioritySupport: false,
    },
    ...overrides,
  };
}

const now = new Date("2026-07-29T00:00:00.000Z");

describe("subscription guard", () => {
  it("allows active and trial subscriptions only inside their validity period", () => {
    expect(() => assertActiveSubscription(subscription(), now)).not.toThrow();
    expect(() => assertActiveSubscription(subscription({ status: "TRIAL" }), now)).not.toThrow();
    expect(() => assertActiveSubscription(null, now)).toThrow();
    expect(() => assertActiveSubscription(subscription({ status: "SUSPENDED" }), now)).toThrow();
    expect(() => assertActiveSubscription(subscription({ status: "EXPIRED" }), now)).toThrow();
    expect(() => assertActiveSubscription(subscription({
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
    }), now)).toThrow();
    expect(() => assertActiveSubscription(subscription({ expiresAt: now }), now)).toThrow();
  });

  it("fails closed when a feature plan is missing or the feature is disabled", () => {
    expect(() => assertSubscriptionFeature(subscription(), "allowPromptPay", now)).not.toThrow();
    expect(() => assertSubscriptionFeature(subscription(), "allowFileUploads", now)).toThrow();
    expect(() => assertSubscriptionFeature(subscription({ plan: null }), "allowPromptPay", now)).toThrow();
    expect(() => assertSubscriptionFeature(null, "allowPromptPay", now)).toThrow();
  });

  it("separates full, grace-period, and read-only access", () => {
    expect(getSubscriptionAccessState(subscription(), now, 7).mode).toBe("FULL");

    const recentlyExpired = subscription({
      status: "EXPIRED",
      expiresAt: new Date("2026-07-27T00:00:00.000Z"),
    });
    expect(getSubscriptionAccessState(recentlyExpired, now, 7)).toMatchObject({
      mode: "GRACE",
      isReadOnly: false,
    });
    expect(() => assertSubscriptionWriteAccess(recentlyExpired, now, 7)).not.toThrow();

    const longExpired = subscription({
      status: "EXPIRED",
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    expect(getSubscriptionAccessState(longExpired, now, 7)).toEqual({
      mode: "READ_ONLY",
      graceEndsAt: null,
      isReadOnly: true,
    });
    expect(() => assertSubscriptionWriteAccess(longExpired, now, 7)).toThrow(
      /อ่านข้อมูลเท่านั้น/,
    );
  });

  it("makes missing, suspended, and not-yet-started subscriptions read-only", () => {
    expect(getSubscriptionAccessState(null, now, 7).mode).toBe("READ_ONLY");
    expect(getSubscriptionAccessState(subscription({ status: "SUSPENDED" }), now, 7).mode)
      .toBe("READ_ONLY");
    expect(getSubscriptionAccessState(subscription({
      startsAt: new Date("2026-08-01T00:00:00.000Z"),
    }), now, 7).mode).toBe("READ_ONLY");
  });
});
