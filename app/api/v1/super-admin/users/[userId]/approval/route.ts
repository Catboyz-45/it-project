import { NextRequest } from "next/server";
import { z } from "zod";
import { reviewAccountApprovalSchema } from "@/lib/domain/account-approval";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin, ApiError } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { reviewPropertyAdminAccount } from "@/lib/server/account-approval";

type Context = { params: Promise<{ userId: string }> };
const userIdSchema = z.cuid();

// อนุมัติหรือปฏิเสธบัญชีเจ้าของหอ ปฏิเสธแล้ว session ที่เปิดอยู่ถูกตัดทิ้ง
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const parsedId = userIdSchema.safeParse((await context.params).userId);
    if (!parsedId.success) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    const input = reviewAccountApprovalSchema.parse(await request.json());
    const data = await reviewPropertyAdminAccount(parsedId.data, auth.userId, input);
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId,
      action: input.status === "APPROVED" ? "PROPERTY_ADMIN_ACCOUNT_APPROVE" : "PROPERTY_ADMIN_ACCOUNT_REJECT",
      targetType: "User",
      targetId: data.id,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
