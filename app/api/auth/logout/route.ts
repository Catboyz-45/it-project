/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/auth/logout สำหรับการยืนยันตัวตนและบัญชีผู้ใช้
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest } from "next/server";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { getRequestAuth, revokeSession } from "@/lib/server/auth";

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
    return apiErrorResponse(error, request);
  }
}
