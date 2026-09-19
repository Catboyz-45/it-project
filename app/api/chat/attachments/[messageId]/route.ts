import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

// โหลดไฟล์แนบของทางเดิม ตรวจสิทธิ์ก่อนอ่านไฟล์
export async function GET(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  try {
    const { propertyId } = await requireRequestProperty(request);
    const { messageId } = await params;
    const attachment = await getDatabase().chatMessage.findFirst({
      where: { id: messageId, propertyId, attachmentKey: { not: null } },
      select: { attachmentKey: true, attachmentMime: true, attachmentName: true },
    });
    if (!attachment?.attachmentKey || !attachment.attachmentMime || !attachment.attachmentName) {
      return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
    }
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
