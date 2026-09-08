/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API PATCH ที่ URL /api/account/profile สำหรับส่วนกลางของระบบ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(120),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแก้ข้อมูลบางส่วนหรือเปลี่ยนสถานะของ API เส้นทางนี้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PATCH(request: NextRequest) {
  try {
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
    return apiErrorResponse(error, request);
  }
}
