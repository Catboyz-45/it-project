/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/v1/tenant/tickets/[ticketId]/replies สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { createTicketReplySchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { createTicketReply, listTicketReplies } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
import { parseTenantRecordId, requireActiveTenant } from "@/lib/server/tenant-auth";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ ticketId: string }> };

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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest, context: Context) {
  try {
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
