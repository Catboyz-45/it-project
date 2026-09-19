import { NextRequest } from "next/server";
import {
  buildingIdSchema,
  updateBuildingSchema,
} from "@/lib/domain/property-structure";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { updateBuilding } from "@/lib/server/property-structure";

type Context = {
  params: Promise<{ propertyId: string; buildingId: string }>;
};

// แก้ชื่อหรือรหัสอาคาร และเปิดปิดการใช้งาน
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(
      request,
      params.propertyId,
    );
    const buildingId = buildingIdSchema.safeParse(params.buildingId);
    if (!buildingId.success) throw new ApiError(404, "ไม่พบอาคาร");

    const building = await updateBuilding(
      propertyId,
      buildingId.data,
      updateBuildingSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: building }, undefined, {
      userId: auth.userId,
      propertyId,
      action: "BUILDING_UPDATE",
      targetType: "Building",
      targetId: building.id,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
