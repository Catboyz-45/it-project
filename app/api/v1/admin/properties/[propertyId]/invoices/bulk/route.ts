import { NextRequest } from "next/server";
import { generateBulkInvoicesSchema } from "@/lib/domain/billing";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { generateBulkInvoices } from "@/lib/server/invoices";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// สร้างร่างบิลทั้งหอในคำขอเดียว ห้องที่ติดปัญหาจะถูกข้ามพร้อมเหตุผล
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const data = await generateBulkInvoices(propertyId, generateBulkInvoicesSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "INVOICE_BULK_CREATE", targetType: "Invoice", targetId: `count:${data.created.length}` });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
