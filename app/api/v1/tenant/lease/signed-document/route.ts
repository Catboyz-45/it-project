/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/tenant/lease/signed-document สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getDatabase } from "@/lib/server/db";
import { z } from "zod";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    if (occupancy.role !== "PRIMARY") throw new ApiError(404, "ไม่พบข้อมูล");
    const requestedLeaseId = request.nextUrl.searchParams.get("leaseId");
    const leaseId = requestedLeaseId ? z.string().cuid().safeParse(requestedLeaseId) : null;
    if (leaseId && !leaseId.success) throw new ApiError(404, "ไม่พบข้อมูล");
    const lease = await getDatabase().lease.findFirst({
      where: {
        ...(leaseId?.success ? { id: leaseId.data } : {}),
        roomId: occupancy.roomId, signedStorageKey: { not: null },
        tenants: { some: { isPrimary: true, occupancy: { tenantProfileId: auth.tenantProfileId, status: "ACTIVE" } } },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      select: { signedStorageKey: true, leaseNumber: true },
    });
    if (!lease?.signedStorageKey) throw new ApiError(404, "ไม่พบข้อมูล");
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
