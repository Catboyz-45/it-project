import { NextRequest } from "next/server";
import { z } from "zod";
import { renewLeaseSchema } from "@/lib/domain/leases";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { renewLease } from "@/lib/server/leases";

type Context = { params: Promise<{ propertyId: string; leaseId: string }> };

// ต่อสัญญา สร้างฉบับใหม่ต่อจากฉบับเดิม ไม่ได้แก้ฉบับเดิม
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const leaseId = z.cuid().safeParse(params.leaseId);
    if (!leaseId.success) throw new ApiError(404, "ไม่พบสัญญา");
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const data = await renewLease(propertyId, leaseId.data, auth.userId, renewLeaseSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, { status: 201 }, {
      userId: auth.userId,
      propertyId,
      action: "LEASE_RENEW",
      targetType: "Lease",
      targetId: data.id,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
