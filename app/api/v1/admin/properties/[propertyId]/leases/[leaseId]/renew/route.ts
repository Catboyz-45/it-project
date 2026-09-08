/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/v1/admin/properties/[propertyId]/leases/[leaseId]/renew สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { renewLeaseSchema } from "@/lib/domain/leases";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { renewLease } from "@/lib/server/leases";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ propertyId: string; leaseId: string }> };

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
    const params = await context.params;
    const leaseId = z.string().cuid().safeParse(params.leaseId);
    if (!leaseId.success) throw new ApiError(404, "ไม่พบสัญญา");
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    const data = await renewLease(propertyId, leaseId.data, auth.userId, renewLeaseSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, { status: 201 }, {
      userId: auth.userId,
      propertyId,
      action: "LEASE_RENEW",
      targetType: "Lease",
      targetId: data.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
