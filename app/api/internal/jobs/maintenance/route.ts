/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API POST ที่ URL /api/internal/jobs/maintenance สำหรับงานภายในของเซิร์ฟเวอร์
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { getServerEnv } from "@/lib/server/env";
import { runMaintenanceJob } from "@/lib/server/maintenance-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “digest” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “authorized” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - secret: ค่า “secret” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function authorized(request: NextRequest, secret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(authorization.slice(7)), digest(secret));
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
    const secret = getServerEnv().JOB_SECRET;
    if (!secret) throw new ApiError(503, "Background jobs are not configured");
    if (!authorized(request, secret)) throw new ApiError(401, "Unauthorized");
    const result = await runMaintenanceJob();
    return apiSuccessResponse(
      request,
      { data: result },
      { status: result.status === "already_running" ? 202 : 200, headers: { "Cache-Control": "no-store" } },
      { action: "MAINTENANCE_JOB_RUN", targetType: "BackgroundJob", targetId: result.status },
    );
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
