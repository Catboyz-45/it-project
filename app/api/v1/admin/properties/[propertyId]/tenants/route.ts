import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { listPropertyTenants } from "@/lib/server/property-management";
import { parsePagination } from "@/lib/server/pagination";
import { z } from "zod";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// รายการผู้เช่าของหอ ค้นและแบ่งหน้าจากฝั่งเซิร์ฟเวอร์
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const query = z.string().trim().max(100).optional().parse(request.nextUrl.searchParams.get("query") ?? undefined);
    return NextResponse.json(await listPropertyTenants(propertyId, parsePagination(request.nextUrl.searchParams), query));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
