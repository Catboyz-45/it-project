import { NextRequest, NextResponse } from "next/server";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { apiErrorResponse } from "@/lib/server/api";
import { countOwnerUnreadMessages } from "@/lib/server/chat";
import { countUnreadTicketReplies } from "@/lib/server/property-operations";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// จำนวนข้อความและคำตอบที่ยังไม่ได้อ่าน ใช้กับป้ายตัวเลขบนเมนู
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const [ticketReplies, messages] = await Promise.all([
      countUnreadTicketReplies({
        viewerUserId: auth.userId,
        propertyId,
        incomingRoles: ["TENANT"],
      }),
      countOwnerUnreadMessages(propertyId),
    ]);
    return NextResponse.json({
      data: {
        total: ticketReplies + messages.tenantMessages + messages.supportMessages,
        ticketReplies,
        tenantMessages: messages.tenantMessages,
        supportMessages: messages.supportMessages,
      },
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
