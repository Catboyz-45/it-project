/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “saas” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { AssignSubscriptionInput, CreateSaasPlanInput, UpdateSaasPlanInput } from "@/lib/domain/saas";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";
export { requireSubscriptionFeature } from "@/lib/server/subscription-guard";

const planSelect = {
  id: true, code: true, name: true, description: true,
  monthlyPrice: true, yearlyPrice: true, maxProperties: true, maxRooms: true,
  allowPromptPay: true, allowFileUploads: true, allowPrioritySupport: true,
  isActive: true, sortOrder: true, createdAt: true, updatedAt: true,
  _count: { select: { subscriptions: true } },
} as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “serialize Plan” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - plan: ค่า “plan” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const serializePlan = <T extends {
  monthlyPrice: { toString(): string };
  yearlyPrice: { toString(): string } | null;
}>(plan: T) => ({
  ...plan,
  monthlyPrice: plan.monthlyPrice.toString(),
  yearlyPrice: plan.yearlyPrice?.toString() ?? null,
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Saas Plans” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - includeInactive: ค่า “include Inactive” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listSaasPlans(includeInactive = false) {
  const plans = await getDatabase().saasPlan.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }],
    select: planSelect,
  });
  return plans.map(serializePlan);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Saas Plans Page” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - includeInactive: ค่า “include Inactive” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - query: ค่า “query” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listSaasPlansPage(
  includeInactive: boolean,
  pagination: PaginationInput,
  query?: string,
) {
  const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(query ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { code: { contains: query, mode: "insensitive" as const } },
        ],
      } : {}),
    };
  const [rows, total] = await getDatabase().$transaction([
    getDatabase().saasPlan.findMany({ where,
    orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }, { id: "asc" }],
    ...paginationQuery(pagination),
    select: planSelect,
    }), getDatabase().saasPlan.count({ where }),
  ]);
  const result = toPaginatedResult(rows, pagination, total);
  return { ...result, data: result.data.map(serializePlan) };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Saas Plan” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function createSaasPlan(input: CreateSaasPlanInput) {
  try {
    return serializePlan(await getDatabase().saasPlan.create({ data: input, select: planSelect }));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) throw new ApiError(409, "รหัสแพ็กเกจนี้ถูกใช้งานแล้ว");
    throw error;
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Saas Plan” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - planId: รหัสภายในของ plan
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function updateSaasPlan(planId: string, input: UpdateSaasPlanInput) {
  if (!await getDatabase().saasPlan.count({ where: { id: planId } })) throw new ApiError(404, "ไม่พบแพ็กเกจ");
  return serializePlan(await getDatabase().saasPlan.update({ where: { id: planId }, data: input, select: planSelect }));
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “assign Property Subscription” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function assignPropertySubscription(propertyId: string, input: AssignSubscriptionInput) {
  return getDatabase().$transaction(async (database) => {
    const property = await database.property.findUnique({
        where: { id: propertyId },
        select: { id: true, memberships: { select: { userId: true } } },
      });
    const plan = await database.saasPlan.findFirst({ where: { id: input.planId, isActive: true } });
    const roomCount = await database.room.count({ where: { propertyId, status: { not: "INACTIVE" } } });
    if (!property) throw new ApiError(404, "ไม่พบหอพัก");
    if (!plan) throw new ApiError(400, "แพ็กเกจไม่พร้อมใช้งาน");
    if (roomCount > plan.maxRooms) throw new ApiError(409, "จำนวนห้องปัจจุบันเกินขีดจำกัดของแพ็กเกจนี้");
    for (const membership of property.memberships) {
      const managedCount = await database.propertyMembership.count({
        where: { userId: membership.userId, property: { isActive: true } },
      });
      if (managedCount > plan.maxProperties) {
        throw new ApiError(409, "จำนวนหอที่ผู้ดูแลรับผิดชอบเกินขีดจำกัดของแพ็กเกจนี้");
      }
    }
    const priceAmount = input.billingInterval === "YEARLY"
      ? plan.yearlyPrice ?? plan.monthlyPrice.mul(12)
      : plan.monthlyPrice;
    return database.propertySubscription.upsert({
      where: { propertyId },
      create: {
        propertyId, planId: plan.id, planName: plan.name, status: input.status,
        billingInterval: input.billingInterval, priceAmount,
        maxProperties: plan.maxProperties, maxRooms: plan.maxRooms,
        startsAt: input.startsAt, expiresAt: input.expiresAt,
        suspendedAt: input.status === "SUSPENDED" ? new Date() : null,
      },
      update: {
        planId: plan.id, planName: plan.name, status: input.status,
        billingInterval: input.billingInterval, priceAmount,
        maxProperties: plan.maxProperties, maxRooms: plan.maxRooms,
        startsAt: input.startsAt, expiresAt: input.expiresAt,
        suspendedAt: input.status === "SUSPENDED" ? new Date() : null,
      },
      select: {
        propertyId: true, planId: true, planName: true, status: true,
        billingInterval: true, priceAmount: true, maxProperties: true, maxRooms: true,
        startsAt: true, expiresAt: true, suspendedAt: true,
      },
    });
  });
}
