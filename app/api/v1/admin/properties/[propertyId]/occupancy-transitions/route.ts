import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { listPropertyOccupancyTransitions } from "@/lib/server/occupancy-transitions";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// ประวัติการย้ายออกและย้ายห้องของทั้งหอ
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    return apiSuccessResponse(request, { data: await listPropertyOccupancyTransitions(propertyId) });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
