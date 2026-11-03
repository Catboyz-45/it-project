import { NextRequest, NextResponse } from "next/server";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { apiErrorResponse } from "@/lib/server/api";
import { listTicketInbox } from "@/lib/server/property-operations";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";

type Context = { params: Promise<{ propertyId: string }> };

// เรื่องแจ้งที่ขึ้นในกล่องข้อความรวมของแชทเล็ก ส่ง ticketId มาเพื่อให้เรื่องนั้นติดมาด้วยแม้ปิดไปนานแล้ว
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const ticketId = request.nextUrl.searchParams.get("ticketId");
    const data = await listTicketInbox({
      viewerUserId: auth.userId,
      propertyId,
      includeTicketId: ticketId ? parseTenantRecordId(ticketId) : undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
