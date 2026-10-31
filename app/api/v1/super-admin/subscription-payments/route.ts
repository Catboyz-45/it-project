import { NextRequest, NextResponse } from "next/server";
import { subscriptionPaymentFilterSchema } from "@/lib/domain/saas";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { parsePagination } from "@/lib/server/pagination";
import { listSubscriptionPayments } from "@/lib/server/subscription-orders";

// หลักฐานค่าสมาชิกของทุกหอ กรองตามสถานะและคำค้นได้ ค่าเริ่มต้นคือคิวที่รอตรวจ
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const params = request.nextUrl.searchParams;
    const filter = subscriptionPaymentFilterSchema.parse({
      status: params.get("status") ?? undefined,
      query: params.get("query")?.slice(0, 160) ?? undefined,
    });
    return NextResponse.json(await listSubscriptionPayments(parsePagination(params), filter));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
