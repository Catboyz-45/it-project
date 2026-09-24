import { NextRequest } from "next/server";
import { z } from "zod";
import { reviewSubscriptionPaymentSchema } from "@/lib/domain/saas";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { reviewSubscriptionPayment } from "@/lib/server/subscription-orders";

type Context = { params: Promise<{ paymentId: string }> };

// ตรวจหลักฐานค่าสมาชิก อนุมัติแล้วระบบต่ออายุแพ็กเกจให้อัตโนมัติ
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const paymentId = z.cuid().safeParse((await context.params).paymentId);
    if (!paymentId.success) throw new ApiError(404, "ไม่พบหลักฐานการชำระ");
    const result = await reviewSubscriptionPayment(
      paymentId.data,
      auth.userId,
      reviewSubscriptionPaymentSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: result }, undefined, {
      userId: auth.userId,
      action: "SUBSCRIPTION_PAYMENT_REVIEW", targetType: "SubscriptionPayment",
      targetId: paymentId.data,
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
