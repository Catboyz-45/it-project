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

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

async function requireOwnerProperty(request: NextRequest, rawPropertyId: string) {
  const auth = await requireRequestAuth(request);
  requireRole(auth, "PROPERTY_ADMIN");
  const propertyId = z.string().cuid().safeParse(rawPropertyId);
  if (!propertyId.success) throw new ApiError(404, "ไม่พบหอพัก");
  requirePropertyAccess(auth, propertyId.data);
  return { auth, propertyId: propertyId.data };
}

// ประวัติคำสั่งซื้อแพ็กเกจของหอ
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireOwnerProperty(request, (await context.params).propertyId);
    return NextResponse.json(await listPropertySubscriptionOrders(
      propertyId,
      parsePagination(request.nextUrl.searchParams),
    ));
  } catch (error) { return apiErrorResponse(error, request); }
}

// สั่งซื้อหรือต่ออายุแพ็กเกจ มีคำสั่งซื้อค้างอยู่ก็สั่งใหม่ไม่ได้
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
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
