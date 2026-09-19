import { NextRequest } from "next/server";
import { tenantRegistrationSchema } from "@/lib/domain/tenant-onboarding";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { registerTenant } from "@/lib/server/tenant-onboarding";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";

// ผู้เช่าสมัครด้วยรหัสเชิญ สมัครแล้วยังเข้าใช้งานไม่ได้ ต้องรอเจ้าของหออนุมัติ
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
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
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
