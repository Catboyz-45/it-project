import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { getParcelImage } from "@/lib/server/property-operations";
type Context = { params: Promise<{ propertyId: string; parcelId: string }> };
// เปิดรูปพัสดุ ตรวจสิทธิ์ก่อนอ่านไฟล์
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params; const { propertyId } = await requireAdminProperty(request, params.propertyId);
    const file = await getStorageAdapter().get(await getParcelImage({ propertyId, parcelId: parseTenantRecordId(params.parcelId) }));
    return new NextResponse(new Uint8Array(file.body), { headers: { "Cache-Control": "private, no-store", "Content-Type": file.contentType.startsWith("image/") ? file.contentType : "image/jpeg", "X-Content-Type-Options": "nosniff" } });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
