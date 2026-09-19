import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { listTenantParcels } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
import { TENANT_RECORD_VIEW_IDS } from "@/lib/tenant-record-view";
import { z } from "zod";

const tenantParcelViewSchema = z.enum(TENANT_RECORD_VIEW_IDS);
// รายการพัสดุของห้องตัวเอง
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    const view = tenantParcelViewSchema.parse(request.nextUrl.searchParams.get("view") ?? "current");
    return NextResponse.json(await listTenantParcels(
      auth.tenantProfileId,
      occupancy.roomId,
      parsePagination(request.nextUrl.searchParams),
      view,
    ));
  }
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  catch (error) { return apiErrorResponse(error, request); }
}
