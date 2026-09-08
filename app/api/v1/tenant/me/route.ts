/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET, PATCH ที่ URL /api/v1/tenant/me สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { updateOwnTenantProfileSchema } from "@/lib/domain/tenant-account";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireTenantAuth } from "@/lib/server/tenant-auth";
import { getTenantAccount, updateTenantAccount } from "@/lib/server/tenant-portal";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireTenantAuth(request);
    return apiSuccessResponse(request, { data: await getTenantAccount(auth.tenantProfileId) });
  } catch (error) { return apiErrorResponse(error, request); }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอแก้ข้อมูลบางส่วนหรือเปลี่ยนสถานะของ API เส้นทางนี้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenantAuth(request);
    const data = await updateTenantAccount(
      auth.tenantProfileId,
      auth.userId,
      updateOwnTenantProfileSchema.parse(await request.json()),
    );
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId,
      action: "TENANT_PROFILE_UPDATE",
      targetType: "TenantProfile",
      targetId: auth.tenantProfileId,
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
