/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/v1/tenant/tickets สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { createTicketSchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { createTenantTicket, listTenantTickets } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
import { TENANT_RECORD_VIEW_IDS } from "@/lib/tenant-record-view";
import { z } from "zod";

const tenantTicketViewSchema = z.enum(TENANT_RECORD_VIEW_IDS);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest) {
  try {
    const { auth } = await requireActiveTenant(request);
    const view = tenantTicketViewSchema.parse(request.nextUrl.searchParams.get("view") ?? "current");
    return NextResponse.json(await listTenantTickets(auth.tenantProfileId, auth.userId, parsePagination(request.nextUrl.searchParams), view));
  }
  catch (error) { return apiErrorResponse(error, request); }
}
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request); const { auth, occupancy } = await requireActiveTenant(request);
    const data = await createTenantTicket({ propertyId: occupancy.propertyId, roomId: occupancy.roomId, tenantProfileId: auth.tenantProfileId, userId: auth.userId, data: createTicketSchema.parse(await request.json()) });
    return apiSuccessResponse(request, { data }, { status: 201 }, {
      userId: auth.userId,
      propertyId: occupancy.propertyId,
      action: "SERVICE_TICKET_CREATE",
      targetType: "ServiceTicket",
      targetId: data.id,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
