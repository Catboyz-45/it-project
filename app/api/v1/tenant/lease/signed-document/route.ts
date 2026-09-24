import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getDatabase } from "@/lib/server/db";
import { z } from "zod";

// ดาวน์โหลดไฟล์สัญญาที่ลงนามแล้ว ตรวจสิทธิ์ก่อนอ่านไฟล์
export async function GET(request: NextRequest) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    if (occupancy.role !== "PRIMARY") throw new ApiError(404, "ไม่พบข้อมูล");
    const requestedLeaseId = request.nextUrl.searchParams.get("leaseId");
    const leaseId = requestedLeaseId ? z.cuid().safeParse(requestedLeaseId) : null;
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
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
