import { NextRequest } from "next/server";
import { updateAnnouncementSchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { updateAnnouncement } from "@/lib/server/property-operations";
type Context = { params: Promise<{ propertyId: string; announcementId: string }> };
// แก้ประกาศ ต้องส่งเวลาที่แก้ล่าสุดมาด้วยกันแก้ทับกัน
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request); const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const id = parseTenantRecordId(params.announcementId);
    const data = await updateAnnouncement(propertyId, id, updateAnnouncementSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "ANNOUNCEMENT_UPDATE", targetType: "Announcement", targetId: id });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
