/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/tenant/tickets/[ticketId]/attachments/[attachmentId] สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant, parseTenantRecordId } from "@/lib/server/tenant-auth";
import { getTicketAttachment, requireTenantTicket } from "@/lib/server/property-operations";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ ticketId: string; attachmentId: string }> };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
  } catch (error) { return apiErrorResponse(error, request); }
}
