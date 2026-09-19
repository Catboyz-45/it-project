import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getSubscriptionPaymentSlip } from "@/lib/server/subscription-orders";

type Context = { params: Promise<{ paymentId: string }> };

// เปิดไฟล์สลิปค่าสมาชิก ตรวจสิทธิ์ก่อนอ่านไฟล์
export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const paymentId = z.string().cuid().safeParse((await context.params).paymentId);
    if (!paymentId.success) throw new ApiError(404, "ไม่พบหลักฐานการชำระ");
    const payment = await getSubscriptionPaymentSlip(paymentId.data);
    const file = await getStorageAdapter().get(payment.storageKey);
    const extension = payment.mimeType === "application/pdf" ? "pdf" : payment.mimeType === "image/png" ? "png" : "jpg";
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${payment.order.orderNumber}.${extension}"`,
        "Content-Type": payment.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
