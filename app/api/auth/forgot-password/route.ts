/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/auth/forgot-password สำหรับการยืนยันตัวตนและบัญชีผู้ใช้
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";
import { assertLoginAllowed, recordLoginFailure } from "@/lib/server/login-throttle";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest) {
  try {
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
    return apiErrorResponse(error, request);
  }
}
