import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { listInvitationRoomOptions } from "@/lib/server/tenant-onboarding";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// ห้องทั้งหอพร้อมสถานะ ใช้กับช่องเลือกห้องในหน้าสร้างคำเชิญ
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    return NextResponse.json({ data: await listInvitationRoomOptions(propertyId) });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
