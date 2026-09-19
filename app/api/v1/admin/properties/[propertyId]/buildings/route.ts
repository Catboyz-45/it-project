import { NextRequest, NextResponse } from "next/server";
import { createBuildingSchema } from "@/lib/domain/property-structure";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import {
  createBuilding,
  listBuildings,
} from "@/lib/server/property-structure";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// รายการอาคารพร้อมชั้น
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(
      request,
      (await context.params).propertyId,
    );
    return NextResponse.json({ data: await listBuildings(propertyId) });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

// สร้างอาคารพร้อมชั้นในคำขอเดียว
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(
      request,
      (await context.params).propertyId,
    );
    const building = await createBuilding(
      propertyId,
      createBuildingSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: building }, { status: 201 }, {
      userId: auth.userId,
      propertyId,
      action: "BUILDING_CREATE",
      targetType: "Building",
      targetId: building.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
