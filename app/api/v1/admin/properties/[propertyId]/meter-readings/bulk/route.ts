import { NextRequest } from "next/server";
import { bulkMeterReadingSchema } from "@/lib/domain/billing";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { recordMeterReadings } from "@/lib/server/meters";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// บันทึกมิเตอร์ทั้งชุดในคำขอเดียว ห้องเยอะจะได้ไม่ต้องยิงทีละห้อง
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const input = bulkMeterReadingSchema.parse(await request.json());
    const data = await recordMeterReadings(propertyId, auth.userId, input.readings);
    return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "METER_READING_BULK_CREATE", targetType: "MeterReading", targetId: `count:${data.length}` });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
