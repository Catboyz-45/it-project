import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { listSaasPlans } from "@/lib/server/saas";

// รายการแพ็กเกจที่เปิดขาย เปิดให้ผู้ใช้ที่เข้าระบบแล้วดูได้ทุกบทบาท
export async function GET() {
  try {
    return NextResponse.json({ data: await listSaasPlans(false) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
