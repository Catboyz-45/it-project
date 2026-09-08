/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “subscription guard” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";

const usableStatuses = new Set<SubscriptionStatus>(["TRIAL", "ACTIVE"]);
const graceEligibleStatuses = new Set<SubscriptionStatus>(["TRIAL", "ACTIVE", "EXPIRED"]);
const millisecondsPerDay = 86_400_000;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Subscription Access Mode” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type SubscriptionAccessMode = "FULL" | "GRACE" | "READ_ONLY";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Subscription Access” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type SubscriptionAccess = {
  status: SubscriptionStatus;
  startsAt: Date;
  expiresAt: Date;
  maxProperties: number;
  maxRooms: number;
  plan: {
    allowPromptPay: boolean;
    allowFileUploads: boolean;
    allowPrioritySupport: boolean;
  } | null;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Subscription Feature” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type SubscriptionFeature =
  | "allowPromptPay"
  | "allowFileUploads"
  | "allowPrioritySupport";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Subscription Access State” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type SubscriptionAccessState = {
  mode: SubscriptionAccessMode;
  graceEndsAt: Date | null;
  isReadOnly: boolean;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Subscription Access State” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - subscription: ค่า “subscription” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - gracePeriodDays: ค่า “grace Period Days” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด SubscriptionAccessState ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function getSubscriptionAccessState(
  subscription: SubscriptionAccess | null | undefined,
  now = new Date(),
  gracePeriodDays = 7,
): SubscriptionAccessState {
  if (
    subscription
    && usableStatuses.has(subscription.status)
    && subscription.startsAt <= now
    && subscription.expiresAt > now
  ) {
    return { mode: "FULL", graceEndsAt: null, isReadOnly: false };
  }

  if (
    subscription
    && graceEligibleStatuses.has(subscription.status)
    && subscription.startsAt <= now
    && subscription.expiresAt <= now
  ) {
    const graceEndsAt = new Date(
      subscription.expiresAt.getTime() + gracePeriodDays * millisecondsPerDay,
    );
    if (graceEndsAt > now) {
      return { mode: "GRACE", graceEndsAt, isReadOnly: false };
    }
  }

  return { mode: "READ_ONLY", graceEndsAt: null, isReadOnly: true };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Active Subscription” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - subscription: ค่า “subscription” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด asserts subscription is SubscriptionAccess ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function assertActiveSubscription(
  subscription: SubscriptionAccess | null | undefined,
  now = new Date(),
): asserts subscription is SubscriptionAccess {
  if (
    !subscription ||
    !usableStatuses.has(subscription.status) ||
    subscription.startsAt > now ||
    subscription.expiresAt <= now
  ) {
    throw new ApiError(403, "แพ็กเกจของหอพักไม่พร้อมใช้งาน");
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Subscription Feature” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - subscription: ค่า “subscription” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - feature: ค่า “feature” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - gracePeriodDays: ค่า “grace Period Days” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export function assertSubscriptionFeature(
  subscription: SubscriptionAccess | null | undefined,
  feature: SubscriptionFeature,
  now = new Date(),
  gracePeriodDays = 7,
) {
  assertSubscriptionWriteAccess(subscription, now, gracePeriodDays);
  if (!subscription.plan?.[feature]) {
    throw new ApiError(403, "แพ็กเกจปัจจุบันไม่รองรับความสามารถนี้");
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Subscription Write Access” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - subscription: ค่า “subscription” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - gracePeriodDays: ค่า “grace Period Days” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด asserts subscription is SubscriptionAccess ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function assertSubscriptionWriteAccess(
  subscription: SubscriptionAccess | null | undefined,
  now = new Date(),
  gracePeriodDays = 7,
): asserts subscription is SubscriptionAccess {
  const access = getSubscriptionAccessState(subscription, now, gracePeriodDays);
  if (access.isReadOnly) {
    throw new ApiError(
      403,
      "แพ็กเกจหมดอายุแล้ว พื้นที่นี้เปิดให้อ่านข้อมูลเท่านั้น กรุณาต่ออายุแพ็กเกจ",
    );
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “find Subscription” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function findSubscription(propertyId: string) {
  return getDatabase().propertySubscription.findUnique({
    where: { propertyId },
    select: {
      status: true,
      startsAt: true,
      expiresAt: true,
      maxProperties: true,
      maxRooms: true,
      plan: {
        select: {
          allowPromptPay: true,
          allowFileUploads: true,
          allowPrioritySupport: true,
        },
      },
    },
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Active Subscription” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireActiveSubscription(propertyId: string) {
  const subscription = await findSubscription(propertyId);
  assertActiveSubscription(subscription);
  return subscription;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Subscription Write Access” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireSubscriptionWriteAccess(propertyId: string) {
  const subscription = await findSubscription(propertyId);
  assertSubscriptionWriteAccess(
    subscription,
    new Date(),
    getServerEnv().SUBSCRIPTION_GRACE_PERIOD_DAYS,
  );
  return subscription;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Property Subscription Access” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getPropertySubscriptionAccess(propertyId: string) {
  const subscription = await findSubscription(propertyId);
  return {
    subscription,
    ...getSubscriptionAccessState(
      subscription,
      new Date(),
      getServerEnv().SUBSCRIPTION_GRACE_PERIOD_DAYS,
    ),
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Subscription Feature” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - feature: ค่า “feature” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireSubscriptionFeature(
  propertyId: string,
  feature: SubscriptionFeature,
) {
  const subscription = await findSubscription(propertyId);
  assertSubscriptionFeature(
    subscription,
    feature,
    new Date(),
    getServerEnv().SUBSCRIPTION_GRACE_PERIOD_DAYS,
  );
  return subscription;
}
