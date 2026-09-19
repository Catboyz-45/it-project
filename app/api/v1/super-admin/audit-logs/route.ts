import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { parsePagination } from "@/lib/server/pagination";
import { listSuperAdminAuditLogs } from "@/lib/server/super-admin-lists";
import { z } from "zod";

// รายการ audit log ค้นจากเหตุการณ์ อีเมล และชื่อหอ
export async function GET(request: NextRequest) {
  try {
    requireRole(await requireRequestAuth(request), "SUPER_ADMIN");
    const query = request.nextUrl.searchParams.get("query")?.trim().slice(0, 160) || undefined;
    const result = z.enum(["SUCCESS", "FAILURE"]).optional().parse(request.nextUrl.searchParams.get("result") || undefined);
    return NextResponse.json(await listSuperAdminAuditLogs(parsePagination(request.nextUrl.searchParams), { query, result }));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
