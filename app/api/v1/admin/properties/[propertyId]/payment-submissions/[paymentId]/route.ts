import { NextRequest } from "next/server";
import { paymentReviewSchema } from "@/lib/domain/payments";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { reviewPaymentSubmission } from "@/lib/server/payments";
type Context = { params: Promise<{ propertyId: string; paymentId: string }> };
// อนุมัติหรือปฏิเสธหลักฐานการชำระ ปฏิเสธต้องมีเหตุผล
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const paymentId = parseTenantRecordId(params.paymentId);
    const input = paymentReviewSchema.parse(await request.json());
    const data = await reviewPaymentSubmission({
      propertyId, paymentId, reviewerId: auth.userId,
      status: input.status, rejectionNote: input.rejectionNote,
    });
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: input.status === "APPROVED" ? "PAYMENT_APPROVE" : "PAYMENT_REJECT", targetType: "PaymentSubmission", targetId: paymentId });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
