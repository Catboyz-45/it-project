import { describe, expect, it } from "vitest";
import {
  assertActiveSubscription,
  assertSubscriptionFeature,
  assertSubscriptionWriteAccess,
  getSubscriptionAccessState,
  type SubscriptionAccess,
} from "@/lib/server/subscription-guard";

// ตัวช่วยสร้างข้อมูลทดสอบ ตั้งค่ากลาง ๆ ไว้แล้วให้แต่ละเคสทับเฉพาะที่สนใจ
// allowFileUploads ตั้งเป็น false ไว้ตั้งแต่ต้น เพื่อใช้ทดสอบความสามารถที่แพ็กเกจไม่รองรับ
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

// ตรึงเวลาไว้ ไม่ใช้เวลาจริง ไม่งั้นตัวทดสอบจะพังเองเมื่อเวลาผ่านไป
const now = new Date("2026-07-29T00:00:00.000Z");

describe("subscription guard", () => {
  // ไล่ครบทุกทางที่ต้องไม่ผ่าน ไม่มีแพ็กเกจ ถูกระงับ หมดอายุ ยังไม่ถึงวันเริ่ม และหมดอายุพอดีวันนี้
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

  // ไม่มีข้อมูลแพ็กเกจต้องถือว่าไม่ผ่าน ไม่ใช่ปล่อยผ่าน นี่คือหลักปฏิเสธไว้ก่อนเมื่อไม่แน่ใจ
  it("fails closed when a feature plan is missing or the feature is disabled", () => {
    expect(() => assertSubscriptionFeature(subscription(), "allowPromptPay", now)).not.toThrow();
    expect(() => assertSubscriptionFeature(subscription(), "allowFileUploads", now)).toThrow();
    expect(() => assertSubscriptionFeature(subscription({ plan: null }), "allowPromptPay", now)).toThrow();
    expect(() => assertSubscriptionFeature(null, "allowPromptPay", now)).toThrow();
  });

  // สามระดับต้องแยกจากกันชัด เพราะช่วงผ่อนผันยังแก้ข้อมูลได้ แต่อ่านอย่างเดียวแก้ไม่ได้
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
