/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/v1/admin/properties/[propertyId]/parcels สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createParcelSchema } from "@/lib/domain/property-operations";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createParcel, listParcels } from "@/lib/server/property-operations";
import { requireSubscriptionFeature } from "@/lib/server/saas";
import { parsePagination } from "@/lib/server/pagination";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: Context) {
  try { const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId); return NextResponse.json(await listParcels(propertyId, parsePagination(request.nextUrl.searchParams))); }
  catch (error) { return apiErrorResponse(error, request); }
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
  let storedKey: string | undefined;
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new ApiError(403, "Request origin is not allowed");
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    await assertUploadRateLimit(request, "parcel");
    const form = await request.formData();
    const input = createParcelSchema.parse({
      roomId: form.get("roomId"),
      recipientTenantId: form.get("recipientTenantId") || undefined,
      note: form.get("note") || undefined,
    });
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      await requireSubscriptionFeature(propertyId, "allowFileUploads");
      if (file.size > 5 * 1024 * 1024) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
      const bytes = new Uint8Array(await file.arrayBuffer());
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: รวมขั้นตอนย่อยของ “png” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
       * รับค่า:
       * - v: ค่า “v” ที่จำเป็นต่อการทำงานของก้อนนี้
       * - i: ค่า “i” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const png = bytes.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i]);
      const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      if (!png && !jpg) throw new ApiError(415, "รองรับเฉพาะ PNG และ JPG");
      storedKey = `parcels/${propertyId}/${randomUUID()}.${png ? "png" : "jpg"}`;
      await getStorageAdapter().put(storedKey, Buffer.from(bytes), png ? "image/png" : "image/jpeg");
    }
    try {
      const data = await createParcel(propertyId, auth.userId, input, storedKey);
      return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "PARCEL_CREATE", targetType: "Parcel", targetId: data.id });
    } catch (error) {
      if (storedKey) await getStorageAdapter().delete(storedKey);
      throw error;
    }
  } catch (error) { return apiErrorResponse(error, request); }
}
