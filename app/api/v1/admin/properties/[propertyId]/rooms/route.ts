/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, POST ที่ URL /api/v1/admin/properties/[propertyId]/rooms สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { createRoomSchema } from "@/lib/domain/property-structure";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createRoom, listRooms } from "@/lib/server/property-structure";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest, context: Context) {
  try {
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
