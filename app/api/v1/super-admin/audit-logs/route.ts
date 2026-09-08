/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/super-admin/audit-logs สำหรับผู้ดูแลแพลตฟอร์ม (Super Admin)
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { parsePagination } from "@/lib/server/pagination";
import { listSuperAdminAuditLogs } from "@/lib/server/super-admin-lists";
import { z } from "zod";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest) {
  try {
    requireRole(await requireRequestAuth(request), "SUPER_ADMIN");
    const query = request.nextUrl.searchParams.get("query")?.trim().slice(0, 160) || undefined;
    const result = z.enum(["SUCCESS", "FAILURE"]).optional().parse(request.nextUrl.searchParams.get("result") || undefined);
    return NextResponse.json(await listSuperAdminAuditLogs(parsePagination(request.nextUrl.searchParams), { query, result }));
  } catch (error) { return apiErrorResponse(error, request); }
}
