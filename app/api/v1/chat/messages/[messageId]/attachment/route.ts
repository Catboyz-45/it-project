import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { getStorageAdapter } from "@/lib/documents/storage";
import { parseChatId, requireChatActorForProperty } from "@/lib/server/chat-auth";
import { getAuthorizedChatAttachment } from "@/lib/server/chat";

type Context = { params: Promise<{ messageId: string }> };

// โหลดไฟล์แนบในแชท ตรวจสิทธิ์จากห้องสนทนาที่ข้อความนั้นอยู่
export async function GET(request: NextRequest, context: Context) {
  try {
    const propertyId = request.nextUrl.searchParams.get("propertyId");
    if (!propertyId) return NextResponse.json({ error: "กรุณาระบุหอพัก" }, { status: 400 });
    const actor = await requireChatActorForProperty(request, propertyId);
    const { messageId } = await context.params;
    const attachment = await getAuthorizedChatAttachment(parseChatId(messageId), actor);
    const file = await getStorageAdapter().get(attachment.attachmentKey);
    const asciiName = attachment.attachmentName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.attachmentName)}`,
        "Content-Type": attachment.attachmentMime,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
