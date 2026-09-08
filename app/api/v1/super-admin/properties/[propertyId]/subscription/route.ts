/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API PUT ที่ URL /api/v1/super-admin/properties/[propertyId]/subscription สำหรับผู้ดูแลแพลตฟอร์ม (Super Admin)
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { assignSubscriptionSchema } from "@/lib/domain/saas";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { assignPropertySubscription } from "@/lib/server/saas";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแทนค่าข้อมูลทั้งชุดของ API เส้นทางนี้ โดยรักษากฎธุรกิจของระบบ
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PUT(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const parsed = z.string().cuid().safeParse((await context.params).propertyId);
    if (!parsed.success) throw new ApiError(404, "ไม่พบหอพัก");
    const data = await assignPropertySubscription(parsed.data, assignSubscriptionSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId, propertyId: parsed.data, action: "PROPERTY_SUBSCRIPTION_ASSIGN",
      targetType: "PropertySubscription", targetId: parsed.data,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
