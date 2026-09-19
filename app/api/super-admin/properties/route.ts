import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  shortName: z.string().trim().min(1).max(80),
}).strict();

// ผู้ดูแลระบบสร้างหอพักใหม่
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const input = schema.parse(await request.json());
    const property = await getDatabase().$transaction(async (database) => {
      const starter = await database.saasPlan.findFirst({ where: { code: "STARTER", isActive: true } });
      if (!starter) throw new Error("Starter SaaS plan is not configured");
      const created = await database.property.create({ data: input, select: { id: true } });
      await database.building.create({
        data: {
          propertyId: created.id,
          name: "อาคารหลัก",
          code: "MAIN",
          floors: { create: { propertyId: created.id, number: 1, label: "ชั้น 1" } },
        },
      });
      const startsAt = new Date();
      await database.propertySubscription.create({
        data: {
          propertyId: created.id, planId: starter.id, planName: starter.name,
          status: "TRIAL", billingInterval: "MONTHLY", priceAmount: 0,
          maxProperties: starter.maxProperties, maxRooms: starter.maxRooms,
          startsAt, expiresAt: new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000),
        },
      });
      return created;
    });
    return apiSuccessResponse(request, { id: property.id }, { status: 201 }, {
      userId: auth.userId, propertyId: property.id, action: "PROPERTY_CREATE",
      targetType: "Property", targetId: property.id,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
