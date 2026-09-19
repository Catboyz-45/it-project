import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { listPendingOccupancies } from "@/lib/server/tenant-onboarding";
import { parsePagination } from "@/lib/server/pagination";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// คำขอเข้าพักที่รออนุมัติ
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    return NextResponse.json(await listPendingOccupancies(propertyId, parsePagination(request.nextUrl.searchParams)));
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
