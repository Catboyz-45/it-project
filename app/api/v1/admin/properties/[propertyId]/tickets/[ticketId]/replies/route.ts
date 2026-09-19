import { NextRequest, NextResponse } from "next/server";
import { createTicketReplySchema } from "@/lib/domain/property-operations";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { createTicketReply, listTicketReplies } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";

type Context = { params: Promise<{ propertyId: string; ticketId: string }> };

// ข้อความตอบกลับในเรื่องแจ้ง
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const data = await listTicketReplies({
      ticketId: parseTenantRecordId(params.ticketId),
      propertyId,
      viewerUserId: auth.userId,
      pagination: parsePagination(request.nextUrl.searchParams),
    });
    return NextResponse.json(data);
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

// ตอบกลับผู้เช่าในเรื่องแจ้ง
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const data = await createTicketReply({
      ticketId: parseTenantRecordId(params.ticketId),
      propertyId,
      actorUserId: auth.userId,
      data: createTicketReplySchema.parse(await request.json()),
    });
    return apiSuccessResponse(request, { data }, { status: 201 }, {
      userId: auth.userId,
      propertyId,
      action: "SERVICE_TICKET_REPLY_CREATE",
      targetType: "TicketReply",
      targetId: data.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
