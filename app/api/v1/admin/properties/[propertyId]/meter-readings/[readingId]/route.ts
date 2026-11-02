import { NextRequest } from "next/server";
import { updateMeterReadingSchema } from "@/lib/domain/billing";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { updateMeterReading } from "@/lib/server/meters";
type Context = { params: Promise<{ propertyId: string; readingId: string }> };
// แก้เลขมิเตอร์ที่จดผิด ใช้ได้เฉพาะรายการที่ยังไม่ถูกดึงไปออกบิล
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request); const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const id = parseTenantRecordId(params.readingId);
    const data = await updateMeterReading(propertyId, auth.userId, id, updateMeterReadingSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "METER_READING_UPDATE", targetType: "MeterReading", targetId: id });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
