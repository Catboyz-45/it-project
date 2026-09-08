/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API PATCH, DELETE ที่ URL /api/v1/admin/properties/[propertyId]/occupancies/[occupancyId] สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { reviewOccupancySchema } from "@/lib/domain/tenant-onboarding";
import { endOccupancySchema } from "@/lib/domain/property-management";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { reviewOccupancy } from "@/lib/server/tenant-onboarding";
import { endPropertyOccupancy } from "@/lib/server/property-management";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string; occupancyId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแก้ข้อมูลบางส่วนหรือเปลี่ยนสถานะของ API เส้นทางนี้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const occupancyId = z.string().cuid().safeParse(params.occupancyId);
    if (!occupancyId.success) throw new ApiError(404, "ไม่พบคำขอ");
    const occupancy = await reviewOccupancy(
      propertyId, occupancyId.data, auth.userId,
      reviewOccupancySchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: occupancy }, undefined, {
      userId: auth.userId, propertyId, action: "OCCUPANCY_REVIEW",
      targetType: "RoomOccupancy", targetId: occupancy.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอลบ ยกเลิก หรือปิดรายการของ API เส้นทางนี้ตามสิทธิ์และกฎธุรกิจ
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const occupancyId = z.string().cuid().safeParse(params.occupancyId);
    if (!occupancyId.success) throw new ApiError(404, "ไม่พบการเข้าพัก");
    const data = await endPropertyOccupancy(
      propertyId,
      occupancyId.data,
      endOccupancySchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId, propertyId, action: "OCCUPANCY_END",
      targetType: "RoomOccupancy", targetId: occupancyId.data,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
