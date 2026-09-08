/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/v1/tenant/invitations/accept สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { acceptTenantInvitationSchema } from "@/lib/domain/tenant-onboarding";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireTenantAuth } from "@/lib/server/tenant-auth";
import { acceptTenantInvitation } from "@/lib/server/tenant-onboarding";

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
    const auth = await requireTenantAuth(request);
    const occupancy = await acceptTenantInvitation(
      auth.tenantProfileId,
      acceptTenantInvitationSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, {
      data: {
        occupancy,
        message: "รับคำเชิญแล้ว กรุณารอเจ้าของหออนุมัติ",
      },
    }, { status: 201 }, {
      userId: auth.userId,
      propertyId: occupancy.property.id,
      action: "TENANT_INVITATION_ACCEPT",
      targetType: "RoomOccupancy",
      targetId: occupancy.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
