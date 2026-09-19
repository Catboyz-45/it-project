import { NextRequest } from "next/server";
import { buildingIdSchema, floorIdSchema, updateFloorSchema } from "@/lib/domain/property-structure";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { updateFloor } from "@/lib/server/property-structure";

type Context = { params: Promise<{ propertyId: string; buildingId: string; floorId: string }> };
// แก้ป้ายกำกับของชั้น
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const buildingId = buildingIdSchema.safeParse(params.buildingId);
    const floorId = floorIdSchema.safeParse(params.floorId);
    if (!buildingId.success || !floorId.success) throw new ApiError(404, "ไม่พบชั้น");
    const data = await updateFloor(propertyId, buildingId.data, floorId.data, updateFloorSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "FLOOR_UPDATE", targetType: "Floor", targetId: floorId.data });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
