import { NextRequest, NextResponse } from "next/server";
import { platformPaymentSettingsSchema } from "@/lib/domain/payment-account";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getPlatformPaymentSettings, savePlatformPaymentSettings } from "@/lib/server/payment-accounts";

// บัญชีรับค่าแพ็กเกจของแพลตฟอร์ม เจ้าของหอเห็นในหน้าต่ออายุแพ็กเกจ
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    return NextResponse.json({ data: await getPlatformPaymentSettings() });
  } catch (error) { return apiErrorResponse(error, request); }
}

// บันทึกทั้งชุด ช่องที่ส่ง null มาคือล้างค่า
export async function PUT(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const data = await savePlatformPaymentSettings(platformPaymentSettingsSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId, action: "PLATFORM_PAYMENT_SETTINGS_UPDATE",
      targetType: "PlatformPaymentSettings", targetId: "default",
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
