import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { listLeaseRoomOptions } from "@/lib/server/leases";
// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };
// ห้องที่ทำสัญญาได้ พร้อมชื่อผู้เช่าหลักและสัญญาที่ค้างอยู่ของแต่ละห้อง
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    return NextResponse.json({ data: await listLeaseRoomOptions(propertyId) });
  } catch (error) { return apiErrorResponse(error, request); }
}
