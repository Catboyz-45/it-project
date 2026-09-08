/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/v1/admin/properties/[propertyId]/invoices สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { billingMonthSchema, generateInvoiceSchema } from "@/lib/domain/billing";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { generateInvoice, listInvoices } from "@/lib/server/invoices";
import { parsePagination } from "@/lib/server/pagination";
import { z } from "zod";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };
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
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const raw = request.nextUrl.searchParams.get("billingMonth");
    const month = raw ? billingMonthSchema.parse(raw) : undefined;
    const status = z.enum(["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"]).optional()
      .parse(request.nextUrl.searchParams.get("status") ?? undefined);
    const query = z.string().trim().max(100).optional()
      .parse(request.nextUrl.searchParams.get("query") ?? undefined);
    return NextResponse.json(await listInvoices(
      propertyId,
      parsePagination(request.nextUrl.searchParams),
      month,
      { status, query },
    ));
  } catch (error) { return apiErrorResponse(error, request); }
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
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const data = await generateInvoice(propertyId, generateInvoiceSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "INVOICE_CREATE", targetType: "Invoice", targetId: data.id });
  } catch (error) { return apiErrorResponse(error, request); }
}
