import { NextRequest, NextResponse } from "next/server";
import { billingMonthSchema, generateInvoiceSchema } from "@/lib/domain/billing";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { generateInvoice, listInvoices } from "@/lib/server/invoices";
import { parsePagination } from "@/lib/server/pagination";
import { z } from "zod";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// รายการบิลพร้อมตัวเลขสรุป ค้นและกรองจากฝั่งเซิร์ฟเวอร์
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
// สร้างร่างบิลทีละห้อง
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const data = await generateInvoice(propertyId, generateInvoiceSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "INVOICE_CREATE", targetType: "Invoice", targetId: data.id });
  } catch (error) { return apiErrorResponse(error, request); }
}
