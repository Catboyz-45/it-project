import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireOwnerChatActor } from "@/lib/server/chat-auth";
import { listConversations } from "@/lib/server/chat";
import { parsePagination } from "@/lib/server/pagination";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// รายการห้องสนทนากับผู้เช่า พร้อมจำนวนที่ยังไม่ได้อ่าน
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await context.params;
    const { actor } = await requireOwnerChatActor(request, propertyId);
    const result = await listConversations(
      actor,
      "TENANT_PROPERTY",
      parsePagination(request.nextUrl.searchParams),
    );
    return NextResponse.json({ conversations: result.data, pageInfo: result.pageInfo });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
