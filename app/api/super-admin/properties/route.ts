/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/super-admin/properties สำหรับผู้ดูแลแพลตฟอร์ม (Super Admin)
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  shortName: z.string().trim().min(1).max(80),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest) {
  try {
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
    return apiErrorResponse(error, request);
  }
}
