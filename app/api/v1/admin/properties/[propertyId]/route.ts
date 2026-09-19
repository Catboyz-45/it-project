import { NextRequest, NextResponse } from "next/server";
import { updatePropertySchema } from "@/lib/domain/property-management";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getPropertyWorkspace, updatePropertyIdentity } from "@/lib/server/property-management";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// ข้อมูลหอพักพร้อมจำนวนอาคาร ห้อง และการเข้าพัก
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    return NextResponse.json({ data: await getPropertyWorkspace(propertyId) });
  } catch (error) { return apiErrorResponse(error, request); }
}

// แก้ชื่อและชื่อย่อของหอ
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const data = await updatePropertyIdentity(propertyId, updatePropertySchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "PROPERTY_UPDATE", targetType: "Property", targetId: propertyId });
  } catch (error) { return apiErrorResponse(error, request); }
}
