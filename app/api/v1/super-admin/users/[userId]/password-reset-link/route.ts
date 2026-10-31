import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse, ApiError, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { sendOwnerPasswordResetLink } from "@/lib/server/password-reset";
import { recordIdSchema } from "@/lib/domain/record-id";

type Context = { params: Promise<{ userId: string }> };

// ส่งลิงก์ตั้งรหัสผ่านทางอีเมลให้เจ้าของหอ รหัสเดิมยังใช้ได้จนกว่าเจ้าของหอจะตั้งใหม่ผ่านลิงก์
// ต่างจากออกรหัสชั่วคราว ผู้ดูแลระบบไม่เห็นรหัสผ่านของใครเลย
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง
    assertSameOrigin(request, null);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const parsed = recordIdSchema.safeParse((await context.params).userId);
    if (!parsed.success) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    const data = await sendOwnerPasswordResetLink(parsed.data);
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId, action: "PROPERTY_ADMIN_PASSWORD_RESET_LINK_SEND",
      targetType: "User", targetId: parsed.data,
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
