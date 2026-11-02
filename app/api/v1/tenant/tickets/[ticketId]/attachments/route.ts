import { randomUUID } from "node:crypto";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
import { NextRequest } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin, readFormData } from "@/lib/server/api";
import { requireActiveTenant, parseTenantRecordId } from "@/lib/server/tenant-auth";
import { attachTicketFile, requireTenantTicket } from "@/lib/server/property-operations";
import { requireSubscriptionFeature } from "@/lib/server/saas";
import { detectUploadSignature } from "@/lib/server/file-signatures";
type Context = { params: Promise<{ ticketId: string }> };
// แนบไฟล์ในเรื่องที่แจ้ง
export async function POST(request: NextRequest, context: Context) {
  let key: string | undefined;
  try {
    // multipart จึงส่ง null ไม่บังคับ JSON ส่วน origin ใช้ตัวตรวจกลางที่ดู x-forwarded-host ด้วย
    // เทียบกับ nextUrl.origin ตรง ๆ ไม่ได้ เพราะหลัง proxy ค่านั้นเป็นที่อยู่ภายใน ไม่ใช่โดเมนจริง
    assertSameOrigin(request, null);
    const { auth, occupancy } = await requireActiveTenant(request);
    await assertUploadRateLimit(request, "ticket");
    await requireSubscriptionFeature(occupancy.propertyId, "allowFileUploads");
    const ticketId = parseTenantRecordId((await context.params).ticketId);
    await requireTenantTicket(auth.tenantProfileId, ticketId);
    const file = (await readFormData(request)).get("file");
    if (!(file instanceof File) || file.size < 1) throw new ApiError(400, "กรุณาเลือกไฟล์");
    if (file.size > 5 * 1024 * 1024) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = detectUploadSignature(bytes, ["png", "jpg", "pdf"]);
    if (!signature) throw new ApiError(415, "รองรับเฉพาะ PNG, JPG และ PDF");
    const { extension, mimeType: mime } = signature;
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
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
