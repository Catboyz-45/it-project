import { NextRequest, NextResponse } from "next/server";
import { createLeaseSchema } from "@/lib/domain/leases";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { createLease, listLeases } from "@/lib/server/leases";
import { parsePagination } from "@/lib/server/pagination";
import { z } from "zod";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// รายการสัญญาเช่าของหอ
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const query = z.string().trim().max(100).optional().parse(request.nextUrl.searchParams.get("query") ?? undefined);
    return NextResponse.json(await listLeases(propertyId, parsePagination(request.nextUrl.searchParams), query));
  } catch (error) { return apiErrorResponse(error, request); }
}
// สร้างสัญญาใหม่ เกิดเป็นร่างเสมอ
export async function POST(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    const data = await createLease(propertyId, auth.userId, createLeaseSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, { status: 201 }, { userId: auth.userId, propertyId, action: "LEASE_CREATE", targetType: "Lease", targetId: data.id });
  } catch (error) { return apiErrorResponse(error, request); }
}
