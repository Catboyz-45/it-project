import { NextRequest, NextResponse } from "next/server";
import { ticketTypeSchema } from "@/lib/domain/enums";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { listAdminTickets } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
import { z } from "zod";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// รายการเรื่องแจ้งซ่อมและร้องเรียน
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const raw = request.nextUrl.searchParams.get("type");
    const type = raw ? ticketTypeSchema.parse(raw) : undefined;
    const status = z.enum(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"]).optional()
      .parse(request.nextUrl.searchParams.get("status") ?? undefined);
    return NextResponse.json(await listAdminTickets(propertyId, auth.userId, parsePagination(request.nextUrl.searchParams), type, status));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
