/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API DELETE ที่ URL /api/v1/admin/properties/[propertyId]/invitations/[invitationId] สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, apiSuccessBinaryResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { revokeInvitation } from "@/lib/server/property-management";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string; invitationId: string }> };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอลบ ยกเลิก หรือปิดรายการของ API เส้นทางนี้ตามสิทธิ์และกฎธุรกิจ
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const id = z.string().cuid().safeParse(params.invitationId);
    if (!id.success) throw new ApiError(404, "ไม่พบรหัสเชิญ");
    await revokeInvitation(propertyId, id.data);
    return apiSuccessBinaryResponse(request, null, { status: 204 }, { userId: auth.userId, propertyId, action: "TENANT_INVITATION_REVOKE", targetType: "TenantInvitation", targetId: id.data });
  } catch (error) { return apiErrorResponse(error, request); }
}
