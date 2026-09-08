/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/tenant/notifications/summary สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getTenantNotificationSummary } from "@/lib/server/tenant-portal";
import { getPropertySubscriptionAccess } from "@/lib/server/subscription-guard";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
    return apiErrorResponse(error, request);
  }
}
