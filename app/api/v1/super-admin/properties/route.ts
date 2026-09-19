import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { parsePagination } from "@/lib/server/pagination";
import { listSuperAdminProperties } from "@/lib/server/super-admin-lists";

// รายการหอพักทั้งระบบ
export async function GET(request: NextRequest) {
  try {
    requireRole(await requireRequestAuth(request), "SUPER_ADMIN");
    return NextResponse.json(await listSuperAdminProperties(
      parsePagination(request.nextUrl.searchParams),
      {
        activeOnly: request.nextUrl.searchParams.get("activeOnly") === "true",
        query: request.nextUrl.searchParams.get("query")?.trim().slice(0, 160),
      },
    ));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
