import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { requirePropertyAccess, requireRequestAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

const idSchema = z.cuid();

// ดาวน์โหลดเอกสารที่สร้างไว้ ตรวจสิทธิ์ก่อนอ่านไฟล์จากที่เก็บ
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestAuth(request);
    const id = idSchema.parse((await context.params).id);
    const document = await getDatabase().generatedDocument.findUnique({ where: { id }, select: { propertyId: true, referenceId: true, storageKey: true } });
    if (!document?.storageKey) throw new ApiError(404, "ไม่พบไฟล์เอกสารหรือไฟล์พ้นระยะเวลาจัดเก็บแล้ว");
    requirePropertyAccess(auth, document.propertyId);
    const file = await getStorageAdapter().get(document.storageKey);
    const safeReference = document.referenceId.replace(/[^a-zA-Z0-9_-]/g, "-");
    return new NextResponse(new Uint8Array(file.body), { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${safeReference}.pdf"`, "Content-Length": String(file.size), "Content-Type": file.contentType, "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
