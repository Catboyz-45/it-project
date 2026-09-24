import { NextRequest } from "next/server";
import { policyPreferenceSchema } from "@/lib/domain/legal-policies";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { getRequestAuth } from "@/lib/server/auth";
import { getPolicyPreferences, recordMarketingPreference, recordRequiredPolicies } from "@/lib/server/legal-policies";
import { setRequestActorContext } from "@/lib/server/request-context";

// อ่านสถานะการยอมรับข้อกำหนดของบัญชีตัวเอง
export async function GET(request: NextRequest) {
  try {
    // ตอบเฉพาะสถานะปัจจุบัน ไม่คืนประวัติการกดยอมรับย้อนหลังออกไป
    const auth = await getRequestAuth(request);
    if (!auth) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
    return apiSuccessResponse(request, { preferences: await getPolicyPreferences(auth.userId) });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}

// บันทึกการยอมรับข้อกำหนดและความยินยอมรับข่าวสาร
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await getRequestAuth(request);
    if (!auth) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
    setRequestActorContext(request, { userId: auth.userId });
    // ตรวจด้วย schema ก่อน ชนิดเอกสารและเวอร์ชันที่ส่งมาจากเบราว์เซอร์จึงปลอมไม่ได้
    const input = policyPreferenceSchema.parse(await request.json());
    // ใช้ id เดียวกันกับที่บันทึกลง log จะได้ตามรอยคำขอนี้ได้ทั้งสาย
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    if (input.action === "accept-required") {
      await recordRequiredPolicies(auth.userId, input, "REQUIRED_GATE", requestId);
    } else {
      await recordMarketingPreference(auth.userId, input.enabled, requestId);
    }
    return apiSuccessResponse(request, { preferences: await getPolicyPreferences(auth.userId) }, undefined, {
      userId: auth.userId,
      action: input.action === "accept-required" ? "POLICY_REQUIRED_ACCEPT" : "POLICY_MARKETING_UPDATE",
      targetType: "PolicyAction",
      targetId: auth.userId,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
