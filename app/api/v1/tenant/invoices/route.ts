/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/tenant/invoices สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { listTenantInvoices } from "@/lib/server/tenant-portal";
import { parsePagination } from "@/lib/server/pagination";
import { TENANT_RECORD_VIEW_IDS } from "@/lib/tenant-record-view";
import { z } from "zod";

const tenantInvoiceViewSchema = z.enum(TENANT_RECORD_VIEW_IDS);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    const view = tenantInvoiceViewSchema.parse(request.nextUrl.searchParams.get("view") ?? "current");
    return NextResponse.json(await listTenantInvoices(
      auth.tenantProfileId,
      occupancy.roomId,
      occupancy.role,
      parsePagination(request.nextUrl.searchParams),
      view,
    ));
  } catch (error) { return apiErrorResponse(error, request); }
}
