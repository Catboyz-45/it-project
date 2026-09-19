import { NextRequest, NextResponse } from "next/server";
import { createInvitationSchema } from "@/lib/domain/tenant-onboarding";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createInvitation, listInvitations } from "@/lib/server/tenant-onboarding";
import { parsePagination } from "@/lib/server/pagination";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// ประวัติคำเชิญผู้เช่า
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    return NextResponse.json(await listInvitations(propertyId, parsePagination(request.nextUrl.searchParams)));
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

// สร้างคำเชิญ รหัสจริงแสดงครั้งนี้ครั้งเดียว ฐานข้อมูลเก็บแค่ค่า hash
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const result = await createInvitation(
      propertyId,
      auth.userId,
      createInvitationSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data: result }, { status: 201 }, {
      userId: auth.userId, propertyId, action: "TENANT_INVITATION_CREATE",
      targetType: "TenantInvitation", targetId: result.invitation.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
