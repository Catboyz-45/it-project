import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { getAdminSlip } from "@/lib/server/payments";
type Context = { params: Promise<{ propertyId: string; paymentId: string }> };
// เปิดไฟล์สลิป ผ่าน API ที่ตรวจสิทธิ์ก่อน ไม่ได้วางไว้ในโฟลเดอร์สาธารณะ
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    const payment = await getAdminSlip(propertyId, parseTenantRecordId(params.paymentId));
    const file = await getStorageAdapter().get(payment.slipStorageKey);
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="payment-slip-${payment.submittedAt.toISOString().slice(0, 10)}"`,
        "Content-Type": payment.slipMime,
        "X-Content-Type-Options": "nosniff",
      },
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
