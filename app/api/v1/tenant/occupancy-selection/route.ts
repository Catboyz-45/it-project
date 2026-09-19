import { NextRequest } from "next/server";
import { selectTenantOccupancySchema } from "@/lib/domain/tenant-onboarding";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import {
  requireTenantAuth,
  requireTenantOccupancy,
  tenantOccupancyCookieName,
} from "@/lib/server/tenant-auth";

const occupancyCookieLifetimeSeconds = 30 * 24 * 60 * 60;

// เลือกว่ากำลังดูห้องไหนอยู่ เก็บไว้ในคุกกี้ ผู้เช่าหนึ่งคนอาจมีหลายห้อง
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
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
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
