import { NextRequest, NextResponse } from "next/server";
import { createRoomSchema } from "@/lib/domain/property-structure";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createRoom, listRooms } from "@/lib/server/property-structure";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// รายการห้องทั้งหมดของหอ
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(
      request,
      (await context.params).propertyId,
    );
    return NextResponse.json({ data: await listRooms(propertyId) });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

// สร้างห้องใหม่ จำนวนห้องถูกจำกัดตามแพ็กเกจ
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(
      request,
      (await context.params).propertyId,
    );
    const room = await createRoom(
      propertyId,
      createRoomSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: room }, { status: 201 }, {
      userId: auth.userId,
      propertyId,
      action: "ROOM_CREATE",
      targetType: "Room",
      targetId: room.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
