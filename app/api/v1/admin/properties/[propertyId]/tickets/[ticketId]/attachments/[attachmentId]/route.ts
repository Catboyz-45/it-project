import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { getTicketAttachment } from "@/lib/server/property-operations";
type Context = { params: Promise<{ propertyId: string; ticketId: string; attachmentId: string }> };
// เปิดไฟล์แนบในเรื่องแจ้ง ตรวจสิทธิ์ก่อนอ่านไฟล์
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params; const { propertyId } = await requireAdminProperty(request, params.propertyId);
    const attachment = await getTicketAttachment({
      propertyId,
      ticketId: parseTenantRecordId(params.ticketId),
      attachmentId: parseTenantRecordId(params.attachmentId),
    });
    const file = await getStorageAdapter().get(attachment.storageKey);
    return new NextResponse(new Uint8Array(file.body), { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`, "Content-Type": attachment.mimeType, "X-Content-Type-Options": "nosniff" } });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
