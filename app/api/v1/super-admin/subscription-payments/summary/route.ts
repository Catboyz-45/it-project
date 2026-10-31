import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getSubscriptionPaymentSummary } from "@/lib/server/subscription-orders";

// ตัวเลขสรุปบนหัวหน้าตรวจค่าสมาชิก โหลดใหม่หลังตรวจแต่ละรายการ
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    return NextResponse.json({ data: await getSubscriptionPaymentSummary() });
  } catch (error) { return apiErrorResponse(error, request); }
}
