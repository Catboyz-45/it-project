import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { canAccessTenantFinancialRecords, parseTenantRecordId, requireActiveTenant, requireOwnedInvoice } from "@/lib/server/tenant-auth";

type Context = { params: Promise<{ invoiceId: string }> };
// รายละเอียดบิลใบเดียว ตรวจความเป็นเจ้าของในคำสั่งฐานข้อมูลเลย
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    if (!canAccessTenantFinancialRecords(occupancy.role, "ACTIVE")) {
      return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
    }
    const id = parseTenantRecordId((await context.params).invoiceId);
    const invoice = await requireOwnedInvoice(auth.tenantProfileId, id);
    return NextResponse.json({
      data: {
        ...invoice,
        subtotal: invoice.subtotal.toString(),
        lateFee: invoice.lateFee.toString(),
        total: invoice.total.toString(),
        items: invoice.items.map((item) => ({
          ...item,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          amount: item.amount.toString(),
        })),
      },
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
