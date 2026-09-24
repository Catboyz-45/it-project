import { NextRequest } from "next/server";
import { z } from "zod";
import { updatePropertyMembershipsSchema } from "@/lib/domain/property-memberships";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { updatePropertyAdminMemberships } from "@/lib/server/property-memberships";

type Context = { params: Promise<{ userId: string }> };

// ตั้งสิทธิ์ว่าบัญชีนี้ดูแลหอไหนได้บ้าง ส่งมาเป็นรายการเต็ม
// ตัด session ทิ้งหลังแก้ เพราะสิทธิ์ถูกอ่านตอนเข้าสู่ระบบ
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const userId = z.cuid().safeParse((await context.params).userId);
    if (!userId.success) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    const input = updatePropertyMembershipsSchema.parse(await request.json());
    const data = await updatePropertyAdminMemberships(userId.data, input);
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId,
      action: "PROPERTY_ADMIN_MEMBERSHIPS_UPDATE",
      targetType: "User",
      targetId: data.id,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
