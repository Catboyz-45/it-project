import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getTenantPaymentAccount } from "@/lib/server/payment-accounts";
import { parseTenantRecordId, requireActiveTenant } from "@/lib/server/tenant-auth";

type Context = { params: Promise<{ invoiceId: string }> };

// บัญชีธนาคารรับค่าเช่าของหอ แสดงคู่กับ QR พร้อมเพย์ในหน้าชำระบิล
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    // ผู้พักร่วมไม่ได้เป็นคนจ่ายบิล จึงไม่เห็นช่องทางชำระ เหมือน QR พร้อมเพย์
    if (occupancy.role !== "PRIMARY") return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
    const invoiceId = parseTenantRecordId((await context.params).invoiceId);
    return NextResponse.json({ data: await getTenantPaymentAccount(auth.tenantProfileId, invoiceId) });
  } catch (error) { return apiErrorResponse(error, request); }
}
