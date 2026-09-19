import { NextRequest } from "next/server";
import { z } from "zod";
import { billingMonthSchema } from "@/lib/domain/billing";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { exportInvoicesCsv, exportTenantsCsv } from "@/lib/server/csv-exports";

type Context = { params: Promise<{ propertyId: string; resource: string }> };

const resourceSchema = z.enum(["invoices", "tenants"]);
const invoiceStatusSchema = z.enum(["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"]);

// ส่งออก CSV ของหอ ใช้ฟังก์ชันเดียวกับที่หน้าจอใช้ ไฟล์จะได้ตรงกับที่เห็น
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
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
