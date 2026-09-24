import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
import { requirePropertyAccess, requireRequestAuth, requireRole } from "@/lib/server/auth";
import { createSubscriptionPayment } from "@/lib/server/subscription-orders";
import { detectUploadSignature } from "@/lib/server/file-signatures";

type Context = { params: Promise<{ propertyId: string; orderId: string }> };
const maxSize = 5 * 1024 * 1024;
// สลิปรับได้ทั้งรูปถ่ายและไฟล์ PDF ที่ธนาคารออกให้
const detect = (bytes: Uint8Array) => detectUploadSignature(bytes, ["png", "jpg", "pdf"]);


// ส่งหลักฐานการโอนค่าสมาชิก
export async function POST(request: NextRequest, context: Context) {
  let storageKey: string | undefined;
  try {
    assertSameOrigin(request, null);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "PROPERTY_ADMIN");
    const params = await context.params;
    const propertyId = z.cuid().safeParse(params.propertyId);
    const orderId = z.cuid().safeParse(params.orderId);
    if (!propertyId.success || !orderId.success) throw new ApiError(404, "ไม่พบคำสั่งซื้อ");
    requirePropertyAccess(auth, propertyId.data);
    const { setRequestActorContext } = await import("@/lib/server/request-context");
    setRequestActorContext(request, { userId: auth.userId, propertyId: propertyId.data });
    await assertUploadRateLimit(request, "subscription-slip");
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new ApiError(400, "กรุณาเลือกไฟล์");
    if (file.size < 1 || file.size > maxSize) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detect(bytes);
    if (!detected) throw new ApiError(415, "รองรับเฉพาะ PNG, JPG และ PDF");
    storageKey = `subscription-slips/${propertyId.data}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${detected.extension}`;
    const storage = getStorageAdapter();
    await storage.put(storageKey, Buffer.from(bytes), detected.mimeType);
    let payment;
    try {
      payment = await createSubscriptionPayment({
        propertyId: propertyId.data, orderId: orderId.data, storageKey,
        mimeType: detected.mimeType, sizeBytes: file.size, submittedByUserId: auth.userId,
      });
    } catch (error) {
      await storage.delete(storageKey);
      throw error;
    }
    return apiSuccessResponse(request, { data: payment }, { status: 201 }, {
      userId: auth.userId, propertyId: propertyId.data,
      action: "SUBSCRIPTION_PAYMENT_CREATE", targetType: "SubscriptionPayment",
      targetId: payment.id,
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
