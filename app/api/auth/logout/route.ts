import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { getRequestAuth, revokeSession } from "@/lib/server/auth";

// ออกจากระบบ ลบทั้งแถว session ในฐานข้อมูลและคุกกี้
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await getRequestAuth(request);
    const response = apiSuccessResponse(
      request,
      { redirectTo: "/login" },
      undefined,
      auth ? { userId: auth.userId, action: "AUTH_LOGOUT" } : undefined,
    );
    await revokeSession(request, response);
    return response;
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
