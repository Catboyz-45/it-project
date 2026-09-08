/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/v1/tenant/register สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { tenantRegistrationSchema } from "@/lib/domain/tenant-onboarding";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { registerTenant } from "@/lib/server/tenant-onboarding";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";

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
    await assertApiRateLimit(request, "registration");
    const result = await registerTenant(tenantRegistrationSchema.parse(await request.json()));
    return apiSuccessResponse(request, {
      data: {
        userId: result.userId,
        occupancyStatus: result.occupancy.status,
        message: "สมัครสำเร็จ กรุณารอเจ้าของหออนุมัติ",
      },
    }, { status: 201 }, {
      userId: result.userId,
      action: "TENANT_REGISTER",
      targetType: "User",
      targetId: result.userId,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
