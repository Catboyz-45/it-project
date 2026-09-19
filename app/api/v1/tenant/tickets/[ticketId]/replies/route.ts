import { NextRequest, NextResponse } from "next/server";
import { createTicketReplySchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { createTicketReply, listTicketReplies } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
import { parseTenantRecordId, requireActiveTenant } from "@/lib/server/tenant-auth";

type Context = { params: Promise<{ ticketId: string }> };

// ข้อความตอบกลับในเรื่องที่ตัวเองแจ้ง
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth } = await requireActiveTenant(request);
    const ticketId = parseTenantRecordId((await context.params).ticketId);
    const data = await listTicketReplies({
      ticketId,
      tenantProfileId: auth.tenantProfileId,
      viewerUserId: auth.userId,
      pagination: parsePagination(request.nextUrl.searchParams),
    });
    return NextResponse.json(data);
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

// ตอบกลับในเรื่องที่ตัวเองแจ้ง
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, occupancy } = await requireActiveTenant(request);
    const ticketId = parseTenantRecordId((await context.params).ticketId);
    const data = await createTicketReply({
      ticketId,
      tenantProfileId: auth.tenantProfileId,
      actorUserId: auth.userId,
      data: createTicketReplySchema.parse(await request.json()),
    });
    return apiSuccessResponse(request, { data }, { status: 201 }, {
      userId: auth.userId,
      propertyId: occupancy.propertyId,
      action: "SERVICE_TICKET_REPLY_CREATE",
      targetType: "TicketReply",
      targetId: data.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
