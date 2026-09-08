/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/v1/tenant/tickets/[ticketId]/attachments สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { randomUUID } from "node:crypto";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
import { NextRequest } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { requireActiveTenant, parseTenantRecordId } from "@/lib/server/tenant-auth";
import { attachTicketFile, requireTenantTicket } from "@/lib/server/property-operations";
import { requireSubscriptionFeature } from "@/lib/server/saas";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ ticketId: string }> };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest, context: Context) {
  let key: string | undefined;
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new ApiError(403, "Request origin is not allowed");
    const { auth, occupancy } = await requireActiveTenant(request);
    await assertUploadRateLimit(request, "ticket");
    await requireSubscriptionFeature(occupancy.propertyId, "allowFileUploads");
    const ticketId = parseTenantRecordId((await context.params).ticketId);
    await requireTenantTicket(auth.tenantProfileId, ticketId);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size < 1) throw new ApiError(400, "กรุณาเลือกไฟล์");
    if (file.size > 5 * 1024 * 1024) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “png” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - v: ค่า “v” ที่จำเป็นต่อการทำงานของก้อนนี้
     * - i: ค่า “i” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const png = bytes.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i]);
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    if (!png && !jpg && !pdf) throw new ApiError(415, "รองรับเฉพาะ PNG, JPG และ PDF");
    const extension = png ? "png" : jpg ? "jpg" : "pdf";
    const mime = png ? "image/png" : jpg ? "image/jpeg" : "application/pdf";
    key = `tickets/${occupancy.propertyId}/${ticketId}/${randomUUID()}.${extension}`;
    const storage = getStorageAdapter();
    await storage.put(key, Buffer.from(bytes), mime);
    try {
      const data = await attachTicketFile(ticketId, auth.userId, key, file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 255), mime, file.size);
      return apiSuccessResponse(request, { data }, { status: 201 }, {
        userId: auth.userId,
        propertyId: occupancy.propertyId,
        action: "SERVICE_TICKET_ATTACHMENT_CREATE",
        targetType: "TicketAttachment",
        targetId: data.id,
      });
    } catch (error) { await storage.delete(key); throw error; }
  } catch (error) { return apiErrorResponse(error, request); }
}
