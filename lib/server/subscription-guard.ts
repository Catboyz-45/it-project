import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";

// ทดลองใช้กับใช้งานจริงถือว่าใช้งานได้เหมือนกัน
const usableStatuses = new Set<SubscriptionStatus>(["TRIAL", "ACTIVE"]);
// หมดอายุแล้วยังได้ช่วงผ่อนผัน แต่ที่ถูกยกเลิกหรือระงับไม่ได้ เพราะเป็นการหยุดโดยตั้งใจ
const graceEligibleStatuses = new Set<SubscriptionStatus>(["TRIAL", "ACTIVE", "EXPIRED"]);
const millisecondsPerDay = 86_400_000;

// สามระดับ ใช้ได้เต็ม ช่วงผ่อนผันที่ยังแก้ได้ และอ่านอย่างเดียว
export type SubscriptionAccessMode = "FULL" | "GRACE" | "READ_ONLY";

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

export type SubscriptionFeature =
  | "allowPromptPay"
  | "allowFileUploads"
  | "allowPrioritySupport";

export type SubscriptionAccessState = {
  mode: SubscriptionAccessMode;
  graceEndsAt: Date | null;
  isReadOnly: boolean;
};

// ตัดสินว่าหอนี้อยู่ระดับไหน เป็นฟังก์ชันบริสุทธิ์ ไม่แตะฐานข้อมูล จึงทดสอบแยกได้
// รับ now กับจำนวนวันผ่อนผันเข้ามา จะได้ตรึงเวลาในการทดสอบได้
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
    // ใช้ได้เต็มเมื่อสถานะใช้งานได้ ถึงวันเริ่มแล้ว และยังไม่ถึงวันหมดอายุ
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
    // ช่วงผ่อนผันยังแก้ข้อมูลได้ตามปกติ ให้เวลาเจ้าของหอไปต่ออายุโดยงานไม่สะดุด
    if (graceEndsAt > now) {
      return { mode: "GRACE", graceEndsAt, isReadOnly: false };
    }
  }

  // ตกมาถึงตรงนี้คืออ่านอย่างเดียว รวมถึงกรณีไม่มีแพ็กเกจเลย ข้อมูลเดิมยังดูได้ไม่หายไปไหน
  return { mode: "READ_ONLY", graceEndsAt: null, isReadOnly: true };
}

// เข้มกว่าตัวอื่น ต้องใช้งานได้จริงเท่านั้น ช่วงผ่อนผันก็ไม่ผ่าน
// ใช้กับงานที่กินทรัพยากรจริงอย่างการสร้าง PDF
export function assertActiveSubscription(
  subscription: SubscriptionAccess | null | undefined,
  now = new Date(),
// asserts บอก TypeScript ว่าผ่านบรรทัดนี้ไปแล้ว subscription ไม่เป็น null แน่นอน ผู้เรียกจะได้ไม่ต้องเช็คซ้ำ
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

// ความสามารถบางอย่างมีเฉพาะแพ็กเกจที่สูงพอ เช่นรับชำระผ่าน PromptPay หรือแนบไฟล์
export function assertSubscriptionFeature(
  subscription: SubscriptionAccess | null | undefined,
  feature: SubscriptionFeature,
  now = new Date(),
  gracePeriodDays = 7,
) {
  // เช็คสิทธิ์เขียนก่อน แล้วค่อยเช็คว่าแพ็กเกจรองรับความสามารถนี้ไหม
  assertSubscriptionWriteAccess(subscription, now, gracePeriodDays);
  if (!subscription.plan?.[feature]) {
    throw new ApiError(403, "แพ็กเกจปัจจุบันไม่รองรับความสามารถนี้");
  }
}

// ด่านที่ใช้บ่อยที่สุด ทุกคำขอที่เปลี่ยนข้อมูลผ่านตัวนี้ ช่วงผ่อนผันยังผ่านได้
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

// เลือกมาเฉพาะฟิลด์ที่ใช้ตัดสินสิทธิ์ ไม่ดึงข้อมูลแพ็กเกจมาทั้งก้อน
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

export async function requireActiveSubscription(propertyId: string) {
  const subscription = await findSubscription(propertyId);
  assertActiveSubscription(subscription);
  return subscription;
}

// รุ่นที่อ่านฐานข้อมูลให้เลย จำนวนวันผ่อนผันมาจากการตั้งค่าของระบบ ไม่ได้ฝังไว้ในโค้ด
export async function requireSubscriptionWriteAccess(propertyId: string) {
  const subscription = await findSubscription(propertyId);
  assertSubscriptionWriteAccess(
    subscription,
    new Date(),
    getServerEnv().SUBSCRIPTION_GRACE_PERIOD_DAYS,
  );
  return subscription;
}

// อ่านสถานะมาเฉย ๆ ไม่โยน error ใช้ตอนต้องส่งสถานะไปให้หน้าจอรู้ว่าจะซ่อนปุ่มไหน
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
