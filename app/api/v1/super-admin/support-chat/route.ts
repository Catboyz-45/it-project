import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { listSuperAdminSupportConversations } from "@/lib/server/chat";
import { parsePagination } from "@/lib/server/pagination";

// รายการห้องสนทนาช่วยเหลือของทุกหอ
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const result = await listSuperAdminSupportConversations(
      parsePagination(request.nextUrl.searchParams),
    );
    return NextResponse.json({ conversations: result.data, pageInfo: result.pageInfo });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
