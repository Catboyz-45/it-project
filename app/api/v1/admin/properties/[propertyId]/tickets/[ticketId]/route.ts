/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API PATCH ที่ URL /api/v1/admin/properties/[propertyId]/tickets/[ticketId] สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { updateTicketSchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { updateTicket } from "@/lib/server/property-operations";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string; ticketId: string }> };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแก้ข้อมูลบางส่วนหรือเปลี่ยนสถานะของ API เส้นทางนี้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request); const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const id = parseTenantRecordId(params.ticketId);
    const data = await updateTicket(propertyId, id, auth.userId, updateTicketSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "SERVICE_TICKET_UPDATE", targetType: "ServiceTicket", targetId: id });
  } catch (error) { return apiErrorResponse(error, request); }
}
