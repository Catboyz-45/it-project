/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/v1/admin/properties/[propertyId]/subscription-orders/[orderId]/payments สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
import { requirePropertyAccess, requireRequestAuth, requireRole } from "@/lib/server/auth";
import { createSubscriptionPayment } from "@/lib/server/subscription-orders";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string; orderId: string }> };
const maxSize = 5 * 1024 * 1024;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “detect” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - bytes: ค่า “bytes” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function detect(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137,80,78,71,13,10,26,10][index])) return { mime: "image/png", extension: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return { mime: "application/pdf", extension: "pdf" };
  return null;
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
  let storageKey: string | undefined;
  try {
    assertSameOrigin(request, null);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "PROPERTY_ADMIN");
    const params = await context.params;
    const propertyId = z.string().cuid().safeParse(params.propertyId);
    const orderId = z.string().cuid().safeParse(params.orderId);
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
    await storage.put(storageKey, Buffer.from(bytes), detected.mime);
    let payment;
    try {
      payment = await createSubscriptionPayment({
        propertyId: propertyId.data, orderId: orderId.data, storageKey,
        mimeType: detected.mime, sizeBytes: file.size, submittedByUserId: auth.userId,
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
  } catch (error) { return apiErrorResponse(error, request); }
}
