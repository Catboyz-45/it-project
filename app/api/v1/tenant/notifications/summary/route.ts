import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getTenantNotificationSummary } from "@/lib/server/tenant-portal";
import { getPropertySubscriptionAccess } from "@/lib/server/subscription-guard";

// ตัวเลขงานค้างทั้งหมดของผู้เช่าในคำขอเดียว
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    const [summary, subscriptionAccess] = await Promise.all([
      getTenantNotificationSummary(
        auth.tenantProfileId,
        auth.userId,
        occupancy.roomId,
        occupancy.role,
      ),
      getPropertySubscriptionAccess(occupancy.propertyId),
    ]);
    return apiSuccessResponse(request, {
      data: {
        ...summary,
        subscriptionAccess: {
          mode: subscriptionAccess.mode,
          isReadOnly: subscriptionAccess.isReadOnly,
          graceEndsAt: subscriptionAccess.graceEndsAt,
        },
      },
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
