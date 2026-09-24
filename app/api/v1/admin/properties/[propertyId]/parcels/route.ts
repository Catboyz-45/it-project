import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createParcelSchema } from "@/lib/domain/property-operations";
import { detectUploadSignature } from "@/lib/server/file-signatures";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createParcel, listParcels } from "@/lib/server/property-operations";
import { requireSubscriptionFeature } from "@/lib/server/saas";
import { parsePagination } from "@/lib/server/pagination";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// รายการพัสดุของหอ
export async function GET(request: NextRequest, context: Context) {
  try { const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId); return NextResponse.json(await listParcels(propertyId, parsePagination(request.nextUrl.searchParams))); }
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  catch (error) { return apiErrorResponse(error, request); }
}
// ลงทะเบียนพัสดุเข้า แนบรูปได้
// เก็บรูปพัสดุไว้นอกโฟลเดอร์สาธารณะ ตั้งชื่อไฟล์เองด้วยค่าสุ่ม ไม่ใช้ชื่อจากผู้ใช้
async function storeParcelPhoto(file: File, propertyId: string) {
  if (file.size > 5 * 1024 * 1024) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = detectUploadSignature(bytes, ["png", "jpg"]);
  if (!signature) throw new ApiError(415, "รองรับเฉพาะ PNG และ JPG");
  const storedKey = `parcels/${propertyId}/${randomUUID()}.${signature.extension}`;
  await getStorageAdapter().put(storedKey, Buffer.from(bytes), signature.mimeType);
  return storedKey;
}

export async function POST(request: NextRequest, context: Context) {
  let storedKey: string | undefined;
  try {
    // เช็ค origin เองเพราะคำขอนี้เป็น multipart จึงใช้ assertSameOrigin ที่บังคับ JSON ไม่ได้
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
      storedKey = await storeParcelPhoto(file, propertyId);
    }
    try {
      const data = await createParcel(propertyId, auth.userId, input, storedKey);
      return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "PARCEL_CREATE", targetType: "Parcel", targetId: data.id });
    } catch (error) {
      if (storedKey) await getStorageAdapter().delete(storedKey);
      throw error;
    }
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
