import { NextRequest, NextResponse } from "next/server";
import { createTicketSchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { createTenantTicket, listTenantTickets } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
import { TENANT_RECORD_VIEW_IDS } from "@/lib/tenant-record-view";
import { z } from "zod";

const tenantTicketViewSchema = z.enum(TENANT_RECORD_VIEW_IDS);
// เรื่องที่ตัวเองแจ้งไว้
export async function GET(request: NextRequest) {
  try {
    const { auth } = await requireActiveTenant(request);
    const view = tenantTicketViewSchema.parse(request.nextUrl.searchParams.get("view") ?? "current");
    return NextResponse.json(await listTenantTickets(auth.tenantProfileId, auth.userId, parsePagination(request.nextUrl.searchParams), view));
  }
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  catch (error) { return apiErrorResponse(error, request); }
}
// แจ้งเรื่องซ่อมหรือร้องเรียน เลือกไม่ระบุตัวตนได้
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request); const { auth, occupancy } = await requireActiveTenant(request);
    const data = await createTenantTicket({ propertyId: occupancy.propertyId, roomId: occupancy.roomId, tenantProfileId: auth.tenantProfileId, userId: auth.userId, data: createTicketSchema.parse(await request.json()) });
    return apiSuccessResponse(request, { data }, { status: 201 }, {
      userId: auth.userId,
      propertyId: occupancy.propertyId,
      action: "SERVICE_TICKET_CREATE",
      targetType: "ServiceTicket",
      targetId: data.id,
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
