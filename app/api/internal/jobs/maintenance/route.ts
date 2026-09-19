import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, apiErrorResponse, apiSuccessResponse } from "@/lib/server/api";
import { getServerEnv } from "@/lib/server/env";
import { runMaintenanceJob } from "@/lib/server/maintenance-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function authorized(request: NextRequest, secret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(authorization.slice(7)), digest(secret));
}

// งานเบื้องหลังตามเวลา ยืนยันด้วย JOB_SECRET ไม่ใช่ session ของผู้ใช้
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
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
