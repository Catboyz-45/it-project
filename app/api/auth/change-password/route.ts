import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { getRequestAuth } from "@/lib/server/auth";
import { changeTemporaryPassword } from "@/lib/server/password-reset";

const schema = z.object({
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "ต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก")
    .regex(/[A-Z]/, "ต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่")
    .regex(/\d/, "ต้องมีตัวเลข"),
}).strict();

// เปลี่ยนรหัสชั่วคราวเป็นรหัสของตัวเอง ใช้ตอนถูกบังคับให้เปลี่ยนหลังเข้าระบบครั้งแรก
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await getRequestAuth(request);
    if (!auth) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
    if (!auth.mustChangePassword) throw new ApiError(403, "บัญชีนี้ไม่ได้อยู่ในขั้นตอนเปลี่ยนรหัสผ่านชั่วคราว");
    const { password } = schema.parse(await request.json());
    await changeTemporaryPassword(auth.userId, password);
    return apiSuccessResponse(request, { redirectTo: "/login?passwordChanged=1" }, undefined, {
      userId: auth.userId, action: "TEMPORARY_PASSWORD_CHANGE", targetType: "User", targetId: auth.userId,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
