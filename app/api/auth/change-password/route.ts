/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/auth/change-password สำหรับการยืนยันตัวตนและบัญชีผู้ใช้
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { getRequestAuth } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/api";
import { changeTemporaryPassword } from "@/lib/server/password-reset";

const schema = z.object({
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "ต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก")
    .regex(/[A-Z]/, "ต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่")
    .regex(/[0-9]/, "ต้องมีตัวเลข"),
}).strict();

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
    const auth = await getRequestAuth(request);
    if (!auth) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
    if (!auth.mustChangePassword) throw new ApiError(403, "บัญชีนี้ไม่ได้อยู่ในขั้นตอนเปลี่ยนรหัสผ่านชั่วคราว");
    const { password } = schema.parse(await request.json());
    await changeTemporaryPassword(auth.userId, password);
    return apiSuccessResponse(request, { redirectTo: "/login?passwordChanged=1" }, undefined, {
      userId: auth.userId, action: "TEMPORARY_PASSWORD_CHANGE", targetType: "User", targetId: auth.userId,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
