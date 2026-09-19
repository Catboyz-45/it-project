import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { listTenantInvoices } from "@/lib/server/tenant-portal";
import { parsePagination } from "@/lib/server/pagination";
import { TENANT_RECORD_VIEW_IDS } from "@/lib/tenant-record-view";
import { z } from "zod";

const tenantInvoiceViewSchema = z.enum(TENANT_RECORD_VIEW_IDS);

// รายการบิลของผู้เช่า เฉพาะผู้เช่าหลักเท่านั้นที่ดูได้
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    const view = tenantInvoiceViewSchema.parse(request.nextUrl.searchParams.get("view") ?? "current");
    return NextResponse.json(await listTenantInvoices(
      auth.tenantProfileId,
      occupancy.roomId,
      occupancy.role,
      parsePagination(request.nextUrl.searchParams),
      view,
    ));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
