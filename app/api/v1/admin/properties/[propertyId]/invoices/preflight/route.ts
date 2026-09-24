import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { billingMonthSchema } from "@/lib/domain/billing";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { preflightInvoices } from "@/lib/server/invoices";

const querySchema = z.object({
  billingMonth: billingMonthSchema,
  roomId: z.cuid().optional(),
}).strict();

// ตรวจล่วงหน้าว่าห้องไหนออกบิลได้
// ใช้ตัวเตรียมข้อมูลตัวเดียวกับตอนสร้างจริง ผลจึงตรงกันเสมอ
export async function GET(request: NextRequest, context: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json({ data: await preflightInvoices(propertyId, query) });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
