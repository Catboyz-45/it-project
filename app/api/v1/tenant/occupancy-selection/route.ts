/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/v1/tenant/occupancy-selection สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { selectTenantOccupancySchema } from "@/lib/domain/tenant-onboarding";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import {
  requireTenantAuth,
  requireTenantOccupancy,
  tenantOccupancyCookieName,
} from "@/lib/server/tenant-auth";

const occupancyCookieLifetimeSeconds = 30 * 24 * 60 * 60;

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
    const auth = await requireTenantAuth(request);
    const input = selectTenantOccupancySchema.parse(await request.json());
    const occupancy = await requireTenantOccupancy(auth.tenantProfileId, input.occupancyId);
    const response = apiSuccessResponse(request, { data: occupancy }, undefined, {
      userId: auth.userId,
      propertyId: occupancy.propertyId,
      action: "TENANT_OCCUPANCY_SELECT",
      targetType: "RoomOccupancy",
      targetId: occupancy.id,
    });
    response.cookies.set(tenantOccupancyCookieName, occupancy.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: occupancyCookieLifetimeSeconds,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
