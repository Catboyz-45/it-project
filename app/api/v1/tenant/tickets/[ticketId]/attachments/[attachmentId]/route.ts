import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant, parseTenantRecordId } from "@/lib/server/tenant-auth";
import { getTicketAttachment, requireTenantTicket } from "@/lib/server/property-operations";
type Context = { params: Promise<{ ticketId: string; attachmentId: string }> };
// เปิดไฟล์แนบในเรื่องที่ตัวเองแจ้ง
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth } = await requireActiveTenant(request); const params = await context.params;
    const ticketId = parseTenantRecordId(params.ticketId);
    await requireTenantTicket(auth.tenantProfileId, ticketId);
    const attachment = await getTicketAttachment({
      tenantProfileId: auth.tenantProfileId,
      ticketId,
      attachmentId: parseTenantRecordId(params.attachmentId),
    });
    const file = await getStorageAdapter().get(attachment.storageKey);
    return new NextResponse(new Uint8Array(file.body), { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`, "Content-Type": attachment.mimeType, "X-Content-Type-Options": "nosniff" } });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
