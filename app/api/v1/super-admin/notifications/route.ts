import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getSuperAdminNotificationCounts } from "@/lib/server/super-admin-notifications";

// จำนวนงานค้างและข้อความที่ยังไม่ได้อ่าน ใช้กับกระดิ่งและป้ายตัวเลขบนเมนูของแอดมินใหญ่
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    return NextResponse.json({ data: await getSuperAdminNotificationCounts() });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
