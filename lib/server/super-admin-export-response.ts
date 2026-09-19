import { NextRequest } from "next/server";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { apiErrorResponse } from "@/lib/server/api";
import { exportSuperAdminCsv, type SuperAdminExportResource } from "@/lib/server/super-admin-exports";

// ส่งออก CSV ของผู้ดูแลระบบ ตรวจสิทธิ์ก่อนแล้วคืนไฟล์ให้ดาวน์โหลด
// ตัดคำค้นที่ 160 ตัวอักษร และ no-store กันไฟล์ที่มีข้อมูลจริงค้างอยู่ในแคช
export async function superAdminExportResponse(request: NextRequest, resource: SuperAdminExportResource) {
  try { requireRole(await requireRequestAuth(request), "SUPER_ADMIN"); const csv = await exportSuperAdminCsv(resource, request.nextUrl.searchParams.get("query")?.trim().slice(0, 160)); return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${resource}.csv"`, "Cache-Control": "no-store" } }); } catch (error) { return apiErrorResponse(error, request); }
}
