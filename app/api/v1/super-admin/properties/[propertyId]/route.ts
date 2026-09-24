import { NextRequest } from "next/server";
import { z } from "zod";
import { superAdminPropertyUpdateSchema } from "@/lib/domain/property-management";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { superAdminUpdateProperty } from "@/lib/server/property-management";
import { getDatabase } from "@/lib/server/db";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// ข้อมูลหอพักหนึ่งแห่งสำหรับผู้ดูแลระบบ รวมแพ็กเกจและรายชื่อผู้ดูแล
export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireRequestAuth(request); requireRole(auth, "SUPER_ADMIN");
    const propertyId = z.cuid().parse((await context.params).propertyId);
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
// เปิดปิดหอ และตั้งว่าใครดูแลหอนี้
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const rawId = (await context.params).propertyId;
    const id = z.cuid().safeParse(rawId);
    if (!id.success) throw new ApiError(404, "ไม่พบหอพัก");
    const data = await superAdminUpdateProperty(id.data, superAdminPropertyUpdateSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId, propertyId: id.data, action: "SUPER_ADMIN_PROPERTY_UPDATE",
      targetType: "Property", targetId: id.data,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
