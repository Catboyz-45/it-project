import { NextRequest, NextResponse } from "next/server";
import { transitionLeaseSchema, updateLeaseSchema } from "@/lib/domain/leases";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getLease, transitionLease, updateLease } from "@/lib/server/leases";
import { z } from "zod";
type Context = { params: Promise<{ propertyId: string; leaseId: string }> };
const id = (value: string) => {
  const parsed = z.string().cuid().safeParse(value);
  if (!parsed.success) throw new ApiError(404, "ไม่พบสัญญา");
  return parsed.data;
};
// ข้อมูลสัญญาฉบับเดียวพร้อมประวัติเวอร์ชัน
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    return NextResponse.json({ data: await getLease(propertyId, id(params.leaseId)) });
  } catch (error) { return apiErrorResponse(error, request); }
}
// แก้สัญญาหรือเปลี่ยนสถานะ ต้องส่ง version มาด้วยกันแก้ทับกัน
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const leaseId = id(params.leaseId);
    const body: unknown = await request.json();
    const transition = transitionLeaseSchema.safeParse(body);
    const data = transition.success
      ? await transitionLease(propertyId, leaseId, transition.data)
      : await updateLease(propertyId, leaseId, auth.userId, updateLeaseSchema.parse(body));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: transition.success ? "LEASE_STATUS_CHANGE" : "LEASE_VERSION_CREATE", targetType: "Lease", targetId: leaseId });
  } catch (error) { return apiErrorResponse(error, request); }
}
