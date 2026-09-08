/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API PATCH ที่ URL /api/v1/super-admin/users/[userId]/approval สำหรับผู้ดูแลแพลตฟอร์ม (Super Admin)
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { reviewAccountApprovalSchema } from "@/lib/domain/account-approval";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin, ApiError } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { reviewPropertyAdminAccount } from "@/lib/server/account-approval";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ userId: string }> };
const userIdSchema = z.string().cuid();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแก้ข้อมูลบางส่วนหรือเปลี่ยนสถานะของ API เส้นทางนี้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const parsedId = userIdSchema.safeParse((await context.params).userId);
    if (!parsedId.success) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    const input = reviewAccountApprovalSchema.parse(await request.json());
    const data = await reviewPropertyAdminAccount(parsedId.data, auth.userId, input);
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId,
      action: input.status === "APPROVED" ? "PROPERTY_ADMIN_ACCOUNT_APPROVE" : "PROPERTY_ADMIN_ACCOUNT_REJECT",
      targetType: "User",
      targetId: data.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
