import { NextRequest } from "next/server";
import { updateParcelSchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { parseTenantRecordId } from "@/lib/server/tenant-auth";
import { updateParcel } from "@/lib/server/property-operations";
type Context = { params: Promise<{ propertyId: string; parcelId: string }> };
// บันทึกว่าผู้เช่ารับพัสดุแล้ว หรือยกเลิกรายการที่ลงผิด
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request); const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const id = parseTenantRecordId(params.parcelId);
    const data = await updateParcel(propertyId, id, updateParcelSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "PARCEL_UPDATE", targetType: "Parcel", targetId: id });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
