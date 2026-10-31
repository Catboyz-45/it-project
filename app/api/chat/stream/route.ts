import { NextRequest } from "next/server";
import { z } from "zod";
import { listPropertyMessagesAfter } from "@/lib/server/chat";
import { createMessageStreamResponse } from "@/lib/server/chat-stream";
import { requireRequestProperty } from "@/lib/server/auth";
import { apiErrorResponse } from "@/lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const afterSchema = z.coerce.date();

// สตรีมข้อความใหม่แบบเรียลไทม์ของทางเดิม
export async function GET(request: NextRequest) {
  let propertyId: string;
  try {
    ({ propertyId } = await requireRequestProperty(request));
  } catch (error) {
    // ไม่ผ่านด่านตรวจสิทธิ์ต้องตอบเป็น 401/403 ตามปกติ ไม่ใช่ปล่อย error หลุดจนกลายเป็น 500
    return apiErrorResponse(error, request);
  }
  const cursor = afterSchema.catch(new Date()).parse(request.nextUrl.searchParams.get("after") ?? new Date().toISOString());
  return createMessageStreamResponse(request, cursor, (after) => listPropertyMessagesAfter(propertyId, after));
}
