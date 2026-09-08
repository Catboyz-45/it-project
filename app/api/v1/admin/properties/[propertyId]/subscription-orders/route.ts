/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/v1/admin/properties/[propertyId]/subscription-orders สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSubscriptionOrderSchema } from "@/lib/domain/saas";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin, ApiError } from "@/lib/server/api";
import { requirePropertyAccess, requireRequestAuth, requireRole } from "@/lib/server/auth";
import { parsePagination } from "@/lib/server/pagination";
import {
  createSubscriptionOrder,
  listPropertySubscriptionOrders,
} from "@/lib/server/subscription-orders";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Owner Property” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - rawPropertyId: รหัสภายในของ raw Property
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function requireOwnerProperty(request: NextRequest, rawPropertyId: string) {
  const auth = await requireRequestAuth(request);
  requireRole(auth, "PROPERTY_ADMIN");
  const propertyId = z.string().cuid().safeParse(rawPropertyId);
  if (!propertyId.success) throw new ApiError(404, "ไม่พบหอพัก");
  requirePropertyAccess(auth, propertyId.data);
  return { auth, propertyId: propertyId.data };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireOwnerProperty(request, (await context.params).propertyId);
    return NextResponse.json(await listPropertySubscriptionOrders(
      propertyId,
      parsePagination(request.nextUrl.searchParams),
    ));
  } catch (error) { return apiErrorResponse(error, request); }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const { auth, propertyId } = await requireOwnerProperty(request, (await context.params).propertyId);
    const order = await createSubscriptionOrder(
      propertyId,
      auth.userId,
      createSubscriptionOrderSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: order }, { status: 201 }, {
      userId: auth.userId, propertyId,
      action: "SUBSCRIPTION_ORDER_CREATE", targetType: "SubscriptionOrder",
      targetId: order.id,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
