import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, ApiError, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { issueTemporaryPassword } from "@/lib/server/password-reset";

type Context = { params: Promise<{ userId: string }> };

// ออกรหัสผ่านชั่วคราว แสดงครั้งเดียว และตัด session ทุกเครื่อง
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const parsed = z.string().cuid().safeParse((await context.params).userId);
    if (!parsed.success) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    const temporaryPassword = await issueTemporaryPassword(parsed.data);
    return apiSuccessResponse(request, { data: { temporaryPassword, mustChangePassword: true } }, undefined, {
      userId: auth.userId, action: "PROPERTY_ADMIN_TEMPORARY_PASSWORD_ISSUE",
      targetType: "User", targetId: parsed.data,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
