import { randomUUID } from "node:crypto";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { parseTenantRecordId, requireActiveTenant } from "@/lib/server/tenant-auth";
import { createPaymentSubmission, listTenantPaymentSubmissions } from "@/lib/server/payments";
import { detectUploadSignature } from "@/lib/server/file-signatures";
type Context = { params: Promise<{ invoiceId: string }> };
const maxSize = 5 * 1024 * 1024;
// สลิปรับได้ทั้งรูปถ่ายและไฟล์ PDF ที่ธนาคารออกให้
const detect = (bytes: Uint8Array) => detectUploadSignature(bytes, ["png", "jpg", "pdf"]);
// ประวัติหลักฐานที่เคยส่งของบิลใบนี้
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    if (occupancy.role !== "PRIMARY") throw new ApiError(404, "ไม่พบข้อมูล");
    const invoiceId = parseTenantRecordId((await context.params).invoiceId);
    return NextResponse.json({ data: await listTenantPaymentSubmissions(auth.tenantProfileId, invoiceId) });
  } catch (error) { return apiErrorResponse(error, request); }
}
// ส่งหลักฐานการโอน ส่งซ้ำระหว่างรอตรวจไม่ได้
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request, null);
    const { auth, occupancy } = await requireActiveTenant(request);
    await assertUploadRateLimit(request, "payment-slip");
    if (occupancy.role !== "PRIMARY") throw new ApiError(404, "ไม่พบข้อมูล");
    const invoiceId = parseTenantRecordId((await context.params).invoiceId);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new ApiError(400, "กรุณาเลือกไฟล์");
    if (file.size < 1 || file.size > maxSize) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detect(bytes);
    if (!detected) throw new ApiError(415, "รองรับเฉพาะ PNG, JPG และ PDF");
    const key = `payment-slips/${occupancy.propertyId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${detected.extension}`;
    const storage = getStorageAdapter();
    await storage.put(key, Buffer.from(bytes), detected.mimeType);
    let data;
    try {
      data = await createPaymentSubmission({
        tenantProfileId: auth.tenantProfileId, invoiceId,
        storageKey: key, mimeType: detected.mimeType, size: file.size,
      });
    } catch (error) {
      await storage.delete(key);
      throw error;
    }
    return apiSuccessResponse(
      request,
      { data: { ...data, amount: data.amount.toString() } },
      { status: 201 },
      {
        userId: auth.userId,
        propertyId: occupancy.propertyId,
        action: "PAYMENT_SUBMISSION_CREATE",
        targetType: "PaymentSubmission",
        targetId: data.id,
      },
    );
  } catch (error) { return apiErrorResponse(error, request); }
}
