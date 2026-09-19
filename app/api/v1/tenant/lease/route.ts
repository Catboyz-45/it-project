import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getTenantLease } from "@/lib/server/tenant-portal";

// ข้อมูลสัญญาของตัวเอง เฉพาะผู้เช่าหลักเท่านั้นที่ดูได้
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    return NextResponse.json({
      data: await getTenantLease(auth.tenantProfileId, occupancy.roomId, occupancy.role),
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
