import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getDashboardReadModel } from "@/lib/server/dashboard-read-model";

// Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
type Context = { params: Promise<{ propertyId: string }> };

// ข้อมูลตั้งต้นของพื้นที่ทำงาน เป็นภาพรวมที่มีเพดาน ไม่ใช่ประวัติทั้งหมด
export async function GET(request: NextRequest, context: Context) {
  try {
    const { propertyId } = await requireAdminProperty(request, (await context.params).propertyId);
    return NextResponse.json({ data: await getDashboardReadModel(propertyId) });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
