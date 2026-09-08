/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/v1/tenant/invoices/[invoiceId]/payment-submissions สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { randomUUID } from "node:crypto";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { parseTenantRecordId, requireActiveTenant } from "@/lib/server/tenant-auth";
import { createPaymentSubmission, listTenantPaymentSubmissions } from "@/lib/server/payments";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ invoiceId: string }> };
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
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    if (occupancy.role !== "PRIMARY") throw new ApiError(404, "ไม่พบข้อมูล");
    const invoiceId = parseTenantRecordId((await context.params).invoiceId);
    return NextResponse.json({ data: await listTenantPaymentSubmissions(auth.tenantProfileId, invoiceId) });
  } catch (error) { return apiErrorResponse(error, request); }
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
    await storage.put(key, Buffer.from(bytes), detected.mime);
    let data;
    try {
      data = await createPaymentSubmission({
        tenantProfileId: auth.tenantProfileId, invoiceId,
        storageKey: key, mimeType: detected.mime, size: file.size,
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
