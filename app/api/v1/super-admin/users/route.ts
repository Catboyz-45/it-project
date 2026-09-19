import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { parsePagination } from "@/lib/server/pagination";
import { listSuperAdminUsers } from "@/lib/server/super-admin-lists";
import { z } from "zod";

// รายการบัญชีเจ้าของหอ กรองตามสถานะอนุมัติได้
export async function GET(request: NextRequest) {
  try {
    requireRole(await requireRequestAuth(request), "SUPER_ADMIN");
    const query = request.nextUrl.searchParams.get("query")?.trim().slice(0, 160) || undefined;
    const approvalStatus = z.enum(["PENDING", "APPROVED", "REJECTED"]).optional().parse(request.nextUrl.searchParams.get("approvalStatus") || undefined);
    return NextResponse.json(await listSuperAdminUsers(parsePagination(request.nextUrl.searchParams), { query, approvalStatus }));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
