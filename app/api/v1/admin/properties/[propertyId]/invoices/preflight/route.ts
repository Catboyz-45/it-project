/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/admin/properties/[propertyId]/invoices/preflight สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { billingMonthSchema } from "@/lib/domain/billing";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { preflightInvoices } from "@/lib/server/invoices";

const querySchema = z.object({
  billingMonth: billingMonthSchema,
  roomId: z.string().cuid().optional(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json({ data: await preflightInvoices(propertyId, query) });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
