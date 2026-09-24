import { NextRequest } from "next/server";
import { z } from "zod";
import { occupancyTransitionSchema } from "@/lib/domain/occupancy-transitions";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { completeOccupancyTransition, getMoveOutReadiness, listOccupancyTransitions } from "@/lib/server/occupancy-transitions";

type Context = { params: Promise<{ propertyId: string; tenantProfileId: string }> };

const tenantId = (raw: string) => {
  const parsed = z.cuid().safeParse(raw);
  if (!parsed.success) throw new ApiError(404, "ไม่พบผู้เช่า");
  return parsed.data;
};

// ตรวจว่าย้ายออกได้หรือยัง มิเตอร์และบิลสุดท้ายครบไหม
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    const parsedTenantId = tenantId(params.tenantProfileId);
    const effectiveDate = request.nextUrl.searchParams.get("effectiveDate");
    if (effectiveDate) {
      const parsedDate = z.coerce.date().safeParse(effectiveDate);
      if (!parsedDate.success) throw new ApiError(400, "วันที่มีผลไม่ถูกต้อง");
      return apiSuccessResponse(request, { data: await getMoveOutReadiness(propertyId, parsedTenantId, parsedDate.data) });
    }
    return apiSuccessResponse(request, { data: await listOccupancyTransitions(propertyId, parsedTenantId) });
  } catch (error) { return apiErrorResponse(error, request); }
}

// ทำรายการย้ายออกหรือย้ายห้อง ปิดสัญญาและสรุปเงินประกัน
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const data = await completeOccupancyTransition(
      propertyId,
      tenantId(params.tenantProfileId),
      auth.userId,
      occupancyTransitionSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data }, { status: 201 }, {
      userId: auth.userId, propertyId, action: data.type, targetType: "OccupancyTransition", targetId: data.id,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
