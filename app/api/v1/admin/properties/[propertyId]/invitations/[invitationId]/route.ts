import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, apiSuccessBinaryResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { revokeInvitation } from "@/lib/server/property-management";

type Context = { params: Promise<{ propertyId: string; invitationId: string }> };
// ยกเลิกคำเชิญที่ยังไม่มีใครใช้
export async function DELETE(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const id = z.string().cuid().safeParse(params.invitationId);
    if (!id.success) throw new ApiError(404, "ไม่พบรหัสเชิญ");
    await revokeInvitation(propertyId, id.data);
    return apiSuccessBinaryResponse(request, null, { status: 204 }, { userId: auth.userId, propertyId, action: "TENANT_INVITATION_REVOKE", targetType: "TenantInvitation", targetId: id.data });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
