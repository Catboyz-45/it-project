import { NextRequest } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/server/auth";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "@/lib/server/login-throttle";
import { verifyPassword } from "@/lib/server/password";
import { hasAcceptedRequiredPolicies } from "@/lib/server/legal-policies";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(256),
}).strict();

const dummyPasswordHash = "scrypt-v1$AAAAAAAAAAAAAAAAAAAAAA==$z89B3WFqfR2gHfnf+BQhQb5aQIsCnmihMRj9J4OajdoHDo/yrjh+2Gv5j18PJvGX2D0cTxnCoDZVQ6ICp3/vqQ==";

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

// เข้าสู่ระบบ ตรวจรหัสผ่านแล้วสร้าง session
// เซิร์ฟเวอร์เป็นคนตัดสินว่าจะพาไปหน้าไหน เพราะแต่ละบทบาทไปคนละที่
// ปลายทางหลังเข้าระบบ ด่านที่ต้องผ่านก่อนมาก่อนเสมอ แล้วค่อยแยกตามบทบาท
function loginDestination(user: { mustChangePassword: boolean; role: string }, requiredPoliciesAccepted: boolean) {
  if (user.mustChangePassword) return "/change-password";
  if (!requiredPoliciesAccepted) return "/legal/accept";
  if (user.role === "SUPER_ADMIN") return "/super-admin";
  return user.role === "TENANT" ? "/tenant" : "/admin";
}

export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const input = loginSchema.parse(await request.json());
    const ip = requestIp(request);
    if (!await assertLoginAllowed(input.email, ip)) {
      throw new ApiError(429, "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ภายหลัง");
    }
    const user = await getDatabase().user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true, role: true, isActive: true, approvalStatus: true, mustChangePassword: true },
    });
    const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? dummyPasswordHash);
    const valid = Boolean(user?.isActive) && user?.approvalStatus === "APPROVED" && passwordMatches;
    if (!user || !valid) {
      await recordLoginFailure(input.email, ip);
      throw new ApiError(401, "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    await clearLoginFailures(input.email, ip);
    const requiredPoliciesAccepted = await hasAcceptedRequiredPolicies(user.id);
    const redirectTo = loginDestination(user, requiredPoliciesAccepted);
    const response = apiSuccessResponse(request, { redirectTo }, undefined, {
      userId: user.id, action: "AUTH_LOGIN", targetType: "User", targetId: user.id,
    });
    await createSession(user.id, response);
    return response;
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
