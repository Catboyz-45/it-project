/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API PUT ที่ URL /api/v1/admin/properties/[propertyId]/catalogs สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { propertyCatalogSchema } from "@/lib/domain/property-catalogs";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแทนค่าข้อมูลทั้งชุดของ API เส้นทางนี้ โดยรักษากฎธุรกิจของระบบ
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PUT(request: NextRequest, context: Context) {
  try {
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
    return apiErrorResponse(error, request);
  }
}
