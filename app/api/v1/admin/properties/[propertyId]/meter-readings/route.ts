import { NextRequest, NextResponse } from "next/server";
import { billingMonthSchema, meterReadingInputSchema } from "@/lib/domain/billing";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { listMeterReadings, recordMeterReading } from "@/lib/server/meters";
import { parsePagination } from "@/lib/server/pagination";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// ประวัติการจดมิเตอร์
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const raw = request.nextUrl.searchParams.get("billingMonth");
    const month = raw ? billingMonthSchema.parse(raw) : undefined;
    return NextResponse.json(await listMeterReadings(
      propertyId,
      parsePagination(request.nextUrl.searchParams),
      month,
    ));
  } catch (error) { return apiErrorResponse(error, request); }
}
// บันทึกมิเตอร์ทีละห้อง
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const data = await recordMeterReading(propertyId, auth.userId, meterReadingInputSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "METER_READING_CREATE", targetType: "MeterReading", targetId: data.id });
  } catch (error) { return apiErrorResponse(error, request); }
}
