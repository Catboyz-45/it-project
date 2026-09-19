import { NextRequest, NextResponse } from "next/server";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { apiErrorResponse } from "@/lib/server/api";
import { countUnreadTicketReplies } from "@/lib/server/property-operations";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// จำนวนข้อความและคำตอบที่ยังไม่ได้อ่าน ใช้กับป้ายตัวเลขบนเมนู
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const ticketReplies = await countUnreadTicketReplies({
      viewerUserId: auth.userId,
      propertyId,
      incomingRoles: ["TENANT"],
    });
    return NextResponse.json({ data: { total: ticketReplies, ticketReplies } });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
