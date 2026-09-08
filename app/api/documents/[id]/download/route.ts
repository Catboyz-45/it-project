/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/documents/[id]/download สำหรับระบบเอกสาร
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { requirePropertyAccess, requireRequestAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

const idSchema = z.string().cuid();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
    return apiErrorResponse(error, request);
  }
}
