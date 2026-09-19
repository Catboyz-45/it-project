import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant, parseTenantRecordId } from "@/lib/server/tenant-auth";
import { getParcelImage } from "@/lib/server/property-operations";
type Context = { params: Promise<{ parcelId: string }> };
// เปิดรูปพัสดุของตัวเอง ตรวจสิทธิ์ก่อนอ่านไฟล์
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    const file = await getStorageAdapter().get(await getParcelImage({
      roomId: occupancy.roomId,
      tenantProfileId: auth.tenantProfileId,
      parcelId: parseTenantRecordId((await context.params).parcelId),
    }));
    return new NextResponse(new Uint8Array(file.body), { headers: { "Cache-Control": "private, no-store", "Content-Type": file.contentType.startsWith("image/") ? file.contentType : "image/jpeg", "X-Content-Type-Options": "nosniff" } });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
