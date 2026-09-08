/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/v1/admin/properties/[propertyId]/buildings/[buildingId]/floors สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import {
  buildingIdSchema,
  createFloorSchema,
} from "@/lib/domain/property-structure";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createFloor } from "@/lib/server/property-structure";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = {
  params: Promise<{ propertyId: string; buildingId: string }>;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(
      request,
      params.propertyId,
    );
    const buildingId = buildingIdSchema.safeParse(params.buildingId);
    if (!buildingId.success) throw new ApiError(404, "ไม่พบอาคาร");

    const floor = await createFloor(
      propertyId,
      buildingId.data,
      createFloorSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: floor }, { status: 201 }, {
      userId: auth.userId,
      propertyId,
      action: "FLOOR_CREATE",
      targetType: "Floor",
      targetId: floor.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
