/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST, GET ที่ URL /api/v1/admin/properties/[propertyId]/leases/[leaseId]/signed-document สำหรับเจ้าของหอหรือผู้ดูแลหอ
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { attachSignedLease, getSignedLeaseKey } from "@/lib/server/leases";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";

export const runtime = "nodejs";
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
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new ApiError(403, "Request origin is not allowed");
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    await assertUploadRateLimit(request, "signed-lease");
    const leaseId = z.string().cuid().safeParse(params.leaseId);
    if (!leaseId.success) throw new ApiError(404, "ไม่พบสัญญา");
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new ApiError(400, "กรุณาเลือกไฟล์");
    if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new ApiError(413, "ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new ApiError(415, "รองรับเฉพาะ PDF");
    const key = `signed-contracts/${propertyId}/${randomUUID()}.pdf`;
    const storage = getStorageAdapter();
    await storage.put(key, Buffer.from(bytes), "application/pdf");
    try {
      await attachSignedLease(propertyId, leaseId.data, key);
    } catch (error) {
      await storage.delete(key);
      throw error;
    }
    return apiSuccessResponse(request, { data: { uploaded: true } }, { status: 201 }, { userId: auth.userId, propertyId, action: "LEASE_SIGNED_DOCUMENT_UPLOAD", targetType: "Lease", targetId: leaseId.data });
  } catch (error) { return apiErrorResponse(error, request); }
}

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
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    const leaseId = z.string().cuid().safeParse(params.leaseId);
    if (!leaseId.success) throw new ApiError(404, "ไม่พบสัญญา");
    const lease = await getSignedLeaseKey(propertyId, leaseId.data);
    const file = await getStorageAdapter().get(lease.signedStorageKey);
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${lease.leaseNumber.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
