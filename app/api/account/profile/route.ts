import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(120),
}).strict();

// แก้ชื่อที่แสดงของบัญชีตัวเอง
export async function PATCH(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    const input = profileSchema.parse(await request.json());
    const user = await getDatabase().user.update({
      where: { id: auth.userId },
      data: { displayName: input.displayName },
      select: { displayName: true, email: true },
    });
    return apiSuccessResponse(request, { user }, undefined, {
      userId: auth.userId,
      action: "ACCOUNT_PROFILE_UPDATE",
      targetType: "User",
      targetId: auth.userId,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
