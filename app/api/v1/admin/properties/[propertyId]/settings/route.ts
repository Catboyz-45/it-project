import { NextRequest, NextResponse } from "next/server";
import { updatePropertySettingsSchema } from "@/lib/domain/property-management";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getPropertyWorkspace, savePropertySettings } from "@/lib/server/property-management";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// อ่านการตั้งค่าของหอ
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    return NextResponse.json({ data: (await getPropertyWorkspace(propertyId)).settings });
  } catch (error) { return apiErrorResponse(error, request); }
}

// บันทึกการตั้งค่าทั้งชุด ส่งมาแทนที่ของเดิมทั้งหมด
export async function PUT(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const data = await savePropertySettings(propertyId, updatePropertySettingsSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, { userId: auth.userId, propertyId, action: "PROPERTY_SETTINGS_UPDATE_V1", targetType: "PropertySettings", targetId: propertyId });
  } catch (error) { return apiErrorResponse(error, request); }
}
