import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";
import { assertLoginAllowed, recordLoginFailure } from "@/lib/server/login-throttle";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();

// ขอลิงก์ตั้งรหัสผ่านใหม่ ตอบเหมือนกันเสมอไม่ว่าอีเมลนั้นจะมีอยู่จริงหรือไม่
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    await assertApiRateLimit(request, "passwordReset");
    const { email } = schema.parse(await request.json());
    const ip = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
    const throttleIdentity = `password-reset:${email}`;
    if (!await assertLoginAllowed(throttleIdentity, ip)) {
      return apiSuccessResponse(request, { message: "หากอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้" }, { status: 202 }, {
        action: "PASSWORD_RESET_REQUEST_THROTTLED", targetType: "PasswordReset",
      });
    }
    await requestPasswordReset(email);
    await recordLoginFailure(throttleIdentity, ip);
    return apiSuccessResponse(request, { message: "หากอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้" }, { status: 202 }, {
      action: "PASSWORD_RESET_REQUEST", targetType: "PasswordReset",
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
