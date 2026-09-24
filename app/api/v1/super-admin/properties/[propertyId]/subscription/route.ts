import { NextRequest } from "next/server";
import { z } from "zod";
import { assignSubscriptionSchema } from "@/lib/domain/saas";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { assignPropertySubscription } from "@/lib/server/saas";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// กำหนดแพ็กเกจให้หอโดยตรง ต่างจากการที่เจ้าของหอสั่งซื้อเอง
export async function PUT(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const parsed = z.cuid().safeParse((await context.params).propertyId);
    if (!parsed.success) throw new ApiError(404, "ไม่พบหอพัก");
    const data = await assignPropertySubscription(parsed.data, assignSubscriptionSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId, propertyId: parsed.data, action: "PROPERTY_SUBSCRIPTION_ASSIGN",
      targetType: "PropertySubscription", targetId: parsed.data,
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
