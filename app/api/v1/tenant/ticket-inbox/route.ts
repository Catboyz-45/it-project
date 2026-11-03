import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { listTicketInbox } from "@/lib/server/property-operations";
import { requireActiveTenant } from "@/lib/server/tenant-auth";

// เรื่องที่ผู้เช่าแจ้งไว้ในหอที่กำลังใช้งาน ขึ้นคู่กับแชทกับหอในหน้าต่างแชทเล็ก
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    const data = await listTicketInbox({
      viewerUserId: auth.userId,
      propertyId: occupancy.propertyId,
      tenantProfileId: auth.tenantProfileId,
    });
    return NextResponse.json({ data });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
