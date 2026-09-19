import { NextRequest, NextResponse } from "next/server";
import { createAnnouncementSchema } from "@/lib/domain/property-operations";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createAnnouncement, listAnnouncements } from "@/lib/server/property-operations";
import { parsePagination } from "@/lib/server/pagination";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// รายการประกาศของหอ
export async function GET(request: NextRequest, context: Context) {
  try { const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId); return NextResponse.json(await listAnnouncements(propertyId, parsePagination(request.nextUrl.searchParams))); }
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  catch (error) { return apiErrorResponse(error, request); }
}
// สร้างประกาศ ส่งถึงทั้งหอหรือเจาะจงอาคาร ชั้น หรือห้อง
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const data = await createAnnouncement(propertyId, auth.userId, createAnnouncementSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "ANNOUNCEMENT_CREATE", targetType: "Announcement", targetId: data.id });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
