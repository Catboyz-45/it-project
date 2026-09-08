/** API สำหรับอ่านสถานะนโยบายและบันทึกการยืนยัน/ถอนความยินยอมของผู้ใช้ที่เข้าสู่ระบบ */
import { NextRequest } from "next/server";
import { policyPreferenceSchema } from "@/lib/domain/legal-policies";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { getRequestAuth } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/api";
import { getPolicyPreferences, recordMarketingPreference, recordRequiredPolicies } from "@/lib/server/legal-policies";
import { setRequestActorContext } from "@/lib/server/request-context";

/** คืนสถานะปัจจุบันเพื่อให้หน้าบัญชีแสดงได้ โดยไม่คืนประวัติภายในที่ไม่จำเป็น */
export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
    return apiSuccessResponse(request, { preferences: await getPolicyPreferences(auth.userId) });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

/** รับเฉพาะ action ที่กำหนดไว้ ป้องกันผู้ใช้ส่งชนิดเอกสารหรือเวอร์ชันปลอมจากเบราว์เซอร์ */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const auth = await getRequestAuth(request);
    if (!auth) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
    setRequestActorContext(request, { userId: auth.userId });
    const input = policyPreferenceSchema.parse(await request.json());
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
