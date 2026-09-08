/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/chat/attachments/[messageId] สำหรับระบบสนทนา
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { apiErrorResponse } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - { params }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
    return apiErrorResponse(error, request);
  }
}
