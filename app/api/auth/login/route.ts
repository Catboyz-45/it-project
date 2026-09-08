/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/auth/login สำหรับการยืนยันตัวตนและบัญชีผู้ใช้
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/server/auth";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "@/lib/server/login-throttle";
import { verifyPassword } from "@/lib/server/password";
import { hasAcceptedRequiredPolicies } from "@/lib/server/legal-policies";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
}).strict();

const dummyPasswordHash = "scrypt-v1$AAAAAAAAAAAAAAAAAAAAAA==$z89B3WFqfR2gHfnf+BQhQb5aQIsCnmihMRj9J4OajdoHDo/yrjh+2Gv5j18PJvGX2D0cTxnCoDZVQ6ICp3/vqQ==";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “request Ip” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขอสร้างข้อมูลหรือสั่งทำงานของ API เส้นทางนี้ หลังตรวจข้อมูลและสิทธิ์
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function POST(request: NextRequest) {
  try {
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
    const redirectTo = user.mustChangePassword ? "/change-password" : !requiredPoliciesAccepted ? "/legal/accept" : user.role === "SUPER_ADMIN"
      ? "/super-admin"
      : user.role === "TENANT" ? "/tenant" : "/admin";
    const response = apiSuccessResponse(request, { redirectTo }, undefined, {
      userId: user.id, action: "AUTH_LOGIN", targetType: "User", targetId: user.id,
    });
    await createSession(user.id, response);
    return response;
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
