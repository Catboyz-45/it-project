/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/chat/messages สำหรับระบบสนทนา
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listTenantMessages, sendAdminMessage } from "@/lib/server/chat";
import { parsePagination } from "@/lib/server/pagination";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";

const tenantIdSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const sendSchema = z.object({
  tenantId: tenantIdSchema,
  tenantName: z.string().trim().min(1).max(160),
  roomNumber: z.string().trim().min(1).max(30),
  body: z.string().trim().min(1).max(4000),
  clientId: z.string().uuid(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest) {
  try {
    const { propertyId } = await requireRequestProperty(request);
    const tenantId = tenantIdSchema.parse(request.nextUrl.searchParams.get("tenantId"));
    const result = await listTenantMessages(
      propertyId,
      tenantId,
      parsePagination(request.nextUrl.searchParams),
    );
    return NextResponse.json({ messages: result.data, pageInfo: result.pageInfo });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { auth, propertyId } = await requireRequestProperty(request);
    const input = sendSchema.parse(await request.json());
    const message = await sendAdminMessage({ propertyId, userId: auth.userId, ...input });
    return apiSuccessResponse(request, { message }, { status: 201 }, {
      userId: auth.userId, propertyId, action: "CHAT_MESSAGE_SEND",
      targetType: "ChatMessage", targetId: message.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
