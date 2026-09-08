/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/super-admin/users สำหรับผู้ดูแลแพลตฟอร์ม (Super Admin)
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
  propertyIds: z.array(z.string().cuid()).min(1).max(50),
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
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const input = schema.parse(await request.json());
    const uniquePropertyIds = [...new Set(input.propertyIds)];
    const propertyCount = await getDatabase().property.count({ where: { id: { in: uniquePropertyIds }, isActive: true } });
    if (propertyCount !== uniquePropertyIds.length) throw new ApiError(400, "ไม่พบหอพักที่เลือก");
    const user = await getDatabase().user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        mustChangePassword: true,
        role: "PROPERTY_ADMIN",
        approvalStatus: "PENDING",
        memberships: { create: uniquePropertyIds.map((propertyId) => ({ propertyId })) },
      },
      select: { id: true },
    });
    return apiSuccessResponse(request, { id: user.id, approvalStatus: "PENDING" }, { status: 201 }, {
      userId: auth.userId, action: "PROPERTY_ADMIN_CREATE_PENDING_APPROVAL",
      targetType: "User", targetId: user.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
