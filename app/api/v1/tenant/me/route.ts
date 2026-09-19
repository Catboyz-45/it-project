import { NextRequest } from "next/server";
import { updateOwnTenantProfileSchema } from "@/lib/domain/tenant-account";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireTenantAuth } from "@/lib/server/tenant-auth";
import { getTenantAccount, updateTenantAccount } from "@/lib/server/tenant-portal";

// ข้อมูลบัญชีผู้เช่าพร้อมรายการเข้าพักทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    return apiSuccessResponse(request, { data: await getTenantAccount(auth.tenantProfileId) });
  } catch (error) { return apiErrorResponse(error, request); }
}

// แก้ข้อมูลติดต่อของตัวเอง ไม่รวมอีเมลและห้องซึ่งต้องผ่านเจ้าของหอ
export async function PATCH(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireTenantAuth(request);
    const data = await updateTenantAccount(
      auth.tenantProfileId,
      auth.userId,
      updateOwnTenantProfileSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId,
      action: "TENANT_PROFILE_UPDATE",
      targetType: "TenantProfile",
      targetId: auth.tenantProfileId,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
