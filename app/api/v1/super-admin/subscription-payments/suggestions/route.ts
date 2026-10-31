import { NextRequest, NextResponse } from "next/server";
import { subscriptionPaymentFilterSchema } from "@/lib/domain/saas";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { suggestSubscriptionPaymentTerms } from "@/lib/server/subscription-orders";

// คำแนะนำระหว่างพิมพ์ในช่องค้นหา คืนชื่อหอ เลขคำสั่งซื้อ และแพ็กเกจที่มีคำที่พิมพ์อยู่
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const params = request.nextUrl.searchParams;
    const filter = subscriptionPaymentFilterSchema.parse({
      status: params.get("status") ?? undefined,
      query: params.get("query")?.slice(0, 160) ?? undefined,
    });
    return NextResponse.json({ data: await suggestSubscriptionPaymentTerms(filter) });
  } catch (error) { return apiErrorResponse(error, request); }
}
