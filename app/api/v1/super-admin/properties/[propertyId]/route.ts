/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, PATCH ที่ URL /api/v1/super-admin/properties/[propertyId] สำหรับผู้ดูแลแพลตฟอร์ม (Super Admin)
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { superAdminPropertyUpdateSchema } from "@/lib/domain/property-management";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { superAdminUpdateProperty } from "@/lib/server/property-management";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };
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
    const auth = await requireRequestAuth(request); requireRole(auth, "SUPER_ADMIN");
    const propertyId = z.string().cuid().parse((await context.params).propertyId);
    const data = await getDatabase().property.findUnique({ where: { id: propertyId }, select: {
      id: true, name: true, shortName: true, isActive: true, createdAt: true,
      _count: { select: { rooms: true, occupancies: true, memberships: true } },
      memberships: { select: { user: { select: { id: true, displayName: true, email: true, isActive: true } } } },
      subscription: { select: { planName: true, status: true, billingInterval: true, startsAt: true, expiresAt: true, maxRooms: true } },
      subscriptionOrders: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, orderNumber: true, planName: true, type: true, status: true, billingInterval: true, amount: true, createdAt: true, paidAt: true, activatedAt: true } },
    } });
    if (!data) throw new ApiError(404, "ไม่พบหอพัก");
    return apiSuccessResponse(request, { data: { ...data, subscriptionOrders: data.subscriptionOrders.map((order) => ({ ...order, amount: order.amount.toString() })) } });
  } catch (error) { return apiErrorResponse(error, request); }
}
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแก้ข้อมูลบางส่วนหรือเปลี่ยนสถานะของ API เส้นทางนี้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const rawId = (await context.params).propertyId;
    const id = z.string().cuid().safeParse(rawId);
    if (!id.success) throw new ApiError(404, "ไม่พบหอพัก");
    const data = await superAdminUpdateProperty(id.data, superAdminPropertyUpdateSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId, propertyId: id.data, action: "SUPER_ADMIN_PROPERTY_UPDATE",
      targetType: "Property", targetId: id.data,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
