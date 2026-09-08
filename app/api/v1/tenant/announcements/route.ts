/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/tenant/announcements สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getDatabase } from "@/lib/server/db";
import { listTenantAnnouncements } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
  } catch (error) { return apiErrorResponse(error, request); }
}
