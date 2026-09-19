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

const serializePlan = <T extends {
  monthlyPrice: { toString(): string };
  yearlyPrice: { toString(): string } | null;
}>(plan: T) => ({
  ...plan,
  monthlyPrice: plan.monthlyPrice.toString(),
  yearlyPrice: plan.yearlyPrice?.toString() ?? null,
});

// รายการแพ็กเกจ ฝั่งผู้ใช้เห็นเฉพาะที่เปิดขาย ส่วนผู้ดูแลระบบเห็นทั้งหมด
export async function listSaasPlans(includeInactive = false) {
  const plans = await getDatabase().saasPlan.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }],
    select: planSelect,
  });
  return plans.map(serializePlan);
}

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

export async function createSaasPlan(input: CreateSaasPlanInput) {
  try {
    return serializePlan(await getDatabase().saasPlan.create({ data: input, select: planSelect }));
  } catch (error) {
    // แปลง error ของฐานข้อมูลเป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง ไม่ปล่อยรายละเอียดภายในออกไป
    // ดักที่ error แทนการเช็คก่อนสร้าง จึงไม่มีช่องว่างระหว่างเช็คกับเขียน
    if (error instanceof Error && error.message.includes("Unique constraint")) throw new ApiError(409, "รหัสแพ็กเกจนี้ถูกใช้งานแล้ว");
    throw error;
  }
}

export async function updateSaasPlan(planId: string, input: UpdateSaasPlanInput) {
  if (!await getDatabase().saasPlan.count({ where: { id: planId } })) throw new ApiError(404, "ไม่พบแพ็กเกจ");
  return serializePlan(await getDatabase().saasPlan.update({ where: { id: planId }, data: input, select: planSelect }));
}

// ผู้ดูแลระบบกำหนดแพ็กเกจให้หอโดยตรง ต่างจากการที่เจ้าของหอสั่งซื้อเอง
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
    // ห้ามลดแพ็กเกจลงต่ำกว่าที่ใช้อยู่จริง ไม่งั้นหอจะอยู่ในสภาพที่เกินสิทธิ์ตั้งแต่วันแรก
    if (roomCount > plan.maxRooms) throw new ApiError(409, "จำนวนห้องปัจจุบันเกินขีดจำกัดของแพ็กเกจนี้");
    // เช็คทุกคนที่ดูแลหอนี้ด้วย เพราะโควตาจำนวนหอผูกกับตัวบุคคล ไม่ใช่ผูกกับหอ
    for (const membership of property.memberships) {
      const managedCount = await database.propertyMembership.count({
        where: { userId: membership.userId, property: { isActive: true } },
      });
      if (managedCount > plan.maxProperties) {
        throw new ApiError(409, "จำนวนหอที่ผู้ดูแลรับผิดชอบเกินขีดจำกัดของแพ็กเกจนี้");
      }
    }
    // ไม่ได้ตั้งราคารายปีไว้ก็คิดจากรายเดือนคูณ 12 ใช้ mul ของ Decimal ไม่ใช่คูณแบบตัวเลขปกติ
    const priceAmount = input.billingInterval === "YEARLY"
      ? plan.yearlyPrice ?? plan.monthlyPrice.mul(12)
      : plan.monthlyPrice;
    return database.propertySubscription.upsert({
      where: { propertyId },
      // คัดลอกชื่อแพ็กเกจ ราคา และโควตามาเก็บไว้ในแถวนี้ด้วย
      // แก้แพ็กเกจทีหลังแล้วหอที่ซื้อไปก่อนจะได้ยังใช้เงื่อนไขเดิม
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
