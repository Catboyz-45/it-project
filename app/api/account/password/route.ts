import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, ApiError, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, revokeAllSessions } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/password";

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

// เปลี่ยนรหัสผ่านของบัญชีตัวเอง ต้องกรอกรหัสเดิมด้วย
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
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
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
