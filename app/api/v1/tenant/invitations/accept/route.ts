import { NextRequest } from "next/server";
import { acceptTenantInvitationSchema } from "@/lib/domain/tenant-onboarding";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireTenantAuth } from "@/lib/server/tenant-auth";
import { acceptTenantInvitation } from "@/lib/server/tenant-onboarding";

// รับคำเชิญเข้าห้องเพิ่ม ใช้ตอนผู้เช่าเดิมได้รหัสของอีกห้องมา
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
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
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
