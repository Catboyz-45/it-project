import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { parsePagination } from "@/lib/server/pagination";
import { listPendingSubscriptionPayments } from "@/lib/server/subscription-orders";

// คิวหลักฐานค่าสมาชิกที่รอตรวจ
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    return NextResponse.json(await listPendingSubscriptionPayments(
      parsePagination(request.nextUrl.searchParams),
      request.nextUrl.searchParams.get("query")?.trim().slice(0, 160) || undefined,
    ));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
