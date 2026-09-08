/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/admin/properties/[propertyId]/exports/[resource] สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { billingMonthSchema } from "@/lib/domain/billing";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { exportInvoicesCsv, exportTenantsCsv } from "@/lib/server/csv-exports";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string; resource: string }> };

const resourceSchema = z.enum(["invoices", "tenants"]);
const invoiceStatusSchema = z.enum(["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"]);

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
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    const resource = resourceSchema.parse(params.resource);
    const query = z.string().trim().max(100).optional().parse(request.nextUrl.searchParams.get("query") || undefined);
    const status = invoiceStatusSchema.optional().parse(request.nextUrl.searchParams.get("status") || undefined);
    const billingMonth = billingMonthSchema.optional().parse(request.nextUrl.searchParams.get("billingMonth") || undefined);
    const csv = resource === "invoices"
      ? await exportInvoicesCsv(propertyId, { billingMonth, query, status })
      : await exportTenantsCsv(propertyId, query);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${resource}-${date}.csv`;
    return new Response(csv, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
