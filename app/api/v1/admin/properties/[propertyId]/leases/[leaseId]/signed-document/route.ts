import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { attachSignedLease, getSignedLeaseKey } from "@/lib/server/leases";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";

export const runtime = "nodejs";
type Context = { params: Promise<{ propertyId: string; leaseId: string }> };
// อัปโหลดไฟล์สัญญาที่ลงนามจริงแล้ว เก็บเป็นหลักฐานคู่กับข้อมูลในระบบ
export async function POST(request: NextRequest, context: Context) {
  try {
    // เช็ค origin เองเพราะคำขอนี้เป็น multipart จึงใช้ assertSameOrigin ที่บังคับ JSON ไม่ได้
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new ApiError(403, "Request origin is not allowed");
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    await assertUploadRateLimit(request, "signed-lease");
    const leaseId = z.cuid().safeParse(params.leaseId);
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

// ดาวน์โหลดไฟล์สัญญาที่ลงนามแล้ว ตรวจสิทธิ์ก่อนอ่านไฟล์จากที่เก็บ
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    const leaseId = z.cuid().safeParse(params.leaseId);
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
