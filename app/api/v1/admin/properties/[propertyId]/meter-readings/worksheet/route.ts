import { NextRequest, NextResponse } from "next/server";
import { billingMonthSchema } from "@/lib/domain/billing";
import { meterTypeSchema } from "@/lib/domain/enums";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getMeterWorksheet } from "@/lib/server/meters";
import { parsePagination } from "@/lib/server/pagination";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// ใบจดมิเตอร์ของเดือนหนึ่ง รวมทุกห้องพร้อมเลขรอบก่อน
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(
      request,
      (await context.params).propertyId,
    );
    const billingMonth = billingMonthSchema.parse(
      request.nextUrl.searchParams.get("billingMonth"),
    );
    const type = meterTypeSchema.parse(request.nextUrl.searchParams.get("type"));
    return NextResponse.json(await getMeterWorksheet(
      propertyId,
      billingMonth,
      type,
      parsePagination(request.nextUrl.searchParams),
    ));
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
