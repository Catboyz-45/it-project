import { NextRequest } from "next/server";
import { z } from "zod";
import { reviewOccupancySchema } from "@/lib/domain/tenant-onboarding";
import { endOccupancySchema } from "@/lib/domain/property-management";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { reviewOccupancy } from "@/lib/server/tenant-onboarding";
import { endPropertyOccupancy } from "@/lib/server/property-management";

type Context = { params: Promise<{ propertyId: string; occupancyId: string }> };

// อนุมัติหรือปฏิเสธคำขอเข้าพัก
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

// สิ้นสุดการเข้าพัก ต้องปิดสัญญาที่ใช้งานอยู่ก่อน
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
