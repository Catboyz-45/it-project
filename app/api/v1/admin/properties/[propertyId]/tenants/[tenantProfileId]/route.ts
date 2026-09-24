import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateTenantProfileSchema } from "@/lib/domain/property-management";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getPropertyTenant, updatePropertyTenant } from "@/lib/server/property-management";

type Context = { params: Promise<{ propertyId: string; tenantProfileId: string }> };
const parseId = (value: string) => {
  const result = z.cuid().safeParse(value);
  if (!result.success) throw new ApiError(404, "ไม่พบผู้เช่า");
  return result.data;
};
// ข้อมูลผู้เช่าคนเดียว
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    return NextResponse.json({ data: await getPropertyTenant(propertyId, parseId(params.tenantProfileId)) });
  } catch (error) { return apiErrorResponse(error, request); }
}
// แก้ข้อมูลติดต่อและข้อมูลรถของผู้เช่า
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const tenantId = parseId(params.tenantProfileId);
    const data = await updatePropertyTenant(propertyId, tenantId, updateTenantProfileSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "TENANT_UPDATE", targetType: "TenantProfile", targetId: tenantId });
  } catch (error) { return apiErrorResponse(error, request); }
}
