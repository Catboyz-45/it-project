/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/account/password สำหรับส่วนกลางของระบบ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, ApiError, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, revokeAllSessions } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/password";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “password Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string()
    .min(12, "รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร")
    .max(128)
    .regex(/[a-z]/, "ต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก")
    .regex(/[A-Z]/, "ต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่")
    .regex(/[0-9]/, "ต้องมีตัวเลข"),
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
  message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
  path: ["newPassword"],
});

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
    const auth = await requireRequestAuth(request);
    const input = passwordSchema.parse(await request.json());
    const user = await getDatabase().user.findUnique({
      where: { id: auth.userId },
      select: { passwordHash: true },
    });
    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new ApiError(400, "รหัสผ่านปัจจุบันไม่ถูกต้อง");
    }
    await getDatabase().user.update({
      where: { id: auth.userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    const response = apiSuccessResponse(request, { redirectTo: "/login" }, undefined, {
      userId: auth.userId,
      action: "ACCOUNT_PASSWORD_CHANGE",
      targetType: "User",
      targetId: auth.userId,
    });
    await revokeAllSessions(auth.userId, response);
    return response;
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
