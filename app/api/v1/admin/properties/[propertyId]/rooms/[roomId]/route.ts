import { NextRequest } from "next/server";
import {
  roomIdSchema,
  updateRoomSchema,
} from "@/lib/domain/property-structure";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { updateRoom } from "@/lib/server/property-structure";

type Context = {
  params: Promise<{ propertyId: string; roomId: string }>;
};

// แก้ข้อมูลห้อง ห้องที่มีคนอยู่เปลี่ยนสถานะเองไม่ได้
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(
      request,
      params.propertyId,
    );
    const roomId = roomIdSchema.safeParse(params.roomId);
    if (!roomId.success) throw new ApiError(404, "ไม่พบห้องพัก");

    const room = await updateRoom(
      propertyId,
      roomId.data,
      updateRoomSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: room }, undefined, {
      userId: auth.userId,
      propertyId,
      action: "ROOM_UPDATE",
      targetType: "Room",
      targetId: room.id,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
