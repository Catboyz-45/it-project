import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getDatabase } from "@/lib/server/db";
import { listTenantAnnouncements } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
// ประกาศที่ห้องนี้ควรเห็น กรองตามอาคาร ชั้น และห้องจากฝั่งเซิร์ฟเวอร์
export async function GET(request: NextRequest) {
  try {
    const { occupancy } = await requireActiveTenant(request);
    const pagination = parsePagination(request.nextUrl.searchParams);
    const room = await getDatabase().room.findUnique({ where: { id: occupancy.roomId }, select: { buildingId: true, floorId: true } });
    if (!room) return NextResponse.json({
      data: [],
      pageInfo: { ...pagination, hasNextPage: false },
    });
    return NextResponse.json(await listTenantAnnouncements(
      occupancy.propertyId,
      room.buildingId,
      room.floorId,
      occupancy.roomId,
      pagination,
    ));
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
