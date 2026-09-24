import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { resetPassword } from "@/lib/server/password-reset";

const schema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "ต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก")
    .regex(/[A-Z]/, "ต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่")
    .regex(/\d/, "ต้องมีตัวเลข"),
}).strict();

// ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล ลิงก์ใช้ได้ครั้งเดียว
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const userId = await resetPassword(input.token, input.password);
    return apiSuccessResponse(request, { redirectTo: "/login?passwordReset=1" }, undefined, {
      userId, action: "PASSWORD_RESET_COMPLETE", targetType: "User", targetId: userId,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
