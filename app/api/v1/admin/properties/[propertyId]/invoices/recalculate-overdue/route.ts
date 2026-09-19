import { NextRequest } from "next/server";
import { recalculateOverdueSchema } from "@/lib/domain/billing";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { recalculateOverdueInvoices } from "@/lib/server/invoices";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// คิดค่าปรับล่าช้าใหม่ เขียนให้รันซ้ำได้โดยยอดไม่บวกซ้อน
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const input = recalculateOverdueSchema.parse(await request.json());
    const data = await recalculateOverdueInvoices(propertyId, input.asOf);
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "INVOICE_OVERDUE_RECALCULATE", targetType: "Invoice", targetId: `count:${data.updated}` });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
