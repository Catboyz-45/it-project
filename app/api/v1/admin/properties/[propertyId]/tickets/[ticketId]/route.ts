import { NextRequest } from "next/server";
import { updateTicketSchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { updateTicket } from "@/lib/server/property-operations";
type Context = { params: Promise<{ propertyId: string; ticketId: string }> };
// เลื่อนสถานะเรื่องแจ้งหรือแก้รายละเอียด
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request); const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const id = parseTenantRecordId(params.ticketId);
    const data = await updateTicket(propertyId, id, auth.userId, updateTicketSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "SERVICE_TICKET_UPDATE", targetType: "ServiceTicket", targetId: id });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
