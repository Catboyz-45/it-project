import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getTenantRoom } from "@/lib/server/tenant-portal";

// ข้อมูลห้องที่พักอยู่ พร้อมข้อมูลติดต่อและกฎของหอ
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    return NextResponse.json({ data: await getTenantRoom(auth.tenantProfileId, occupancy.roomId) });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
