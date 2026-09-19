import { NextRequest } from "next/server";
import {
  buildingIdSchema,
  createFloorSchema,
} from "@/lib/domain/property-structure";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createFloor } from "@/lib/server/property-structure";

type Context = {
  params: Promise<{ propertyId: string; buildingId: string }>;
};

// เพิ่มชั้นในอาคาร
export async function POST(request: NextRequest, context: Context) {
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
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
