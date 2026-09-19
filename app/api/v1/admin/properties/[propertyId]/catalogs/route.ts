import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { propertyCatalogSchema } from "@/lib/domain/property-catalogs";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getDatabase } from "@/lib/server/db";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// บันทึกรายการตั้งต้นทั้งชุด
export async function PUT(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const input = propertyCatalogSchema.parse(await request.json());
    await getDatabase().$transaction(async (database) => {
      await Promise.all([
        database.roomTypeConfig.deleteMany({ where: { propertyId } }),
        database.serviceChargeConfig.deleteMany({ where: { propertyId } }),
      ]);
      await Promise.all([
        input.roomTypes.length ? database.roomTypeConfig.createMany({ data: input.roomTypes.map((item) => ({
          propertyId, name: item.name, monthlyRent: item.rent, depositAmount: item.deposit, capacity: item.capacity,
        })) }) : Promise.resolve(),
        input.serviceCharges.length ? database.serviceChargeConfig.createMany({ data: input.serviceCharges.map((item) => ({ propertyId, ...item })) }) : Promise.resolve(),
      ]);
      for (const item of input.furnitureOptions) {
        await database.furnitureOption.upsert({
          where: { propertyId_name: { propertyId, name: item.name } },
          create: { propertyId, ...item },
          update: { isDefault: item.isDefault },
        });
      }
      await database.furnitureOption.deleteMany({
        where: {
          propertyId,
          name: { notIn: input.furnitureOptions.map((item) => item.name) },
          rooms: { none: {} },
        },
      });
    });
    return apiSuccessResponse(request, { success: true }, undefined, { userId: auth.userId, propertyId, action: "PROPERTY_CATALOGS_REPLACE", targetType: "Property", targetId: propertyId });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
