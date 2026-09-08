/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/super-admin/subscription-payments/[paymentId]/slip สำหรับผู้ดูแลแพลตฟอร์ม (Super Admin)
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getSubscriptionPaymentSlip } from "@/lib/server/subscription-orders";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ paymentId: string }> };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบคำขออ่านข้อมูลของ API เส้นทางนี้ หลังตรวจสิทธิ์และข้อมูลใน URL
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const paymentId = z.string().cuid().safeParse((await context.params).paymentId);
    if (!paymentId.success) throw new ApiError(404, "ไม่พบหลักฐานการชำระ");
    const payment = await getSubscriptionPaymentSlip(paymentId.data);
    const file = await getStorageAdapter().get(payment.storageKey);
    const extension = payment.mimeType === "application/pdf" ? "pdf" : payment.mimeType === "image/png" ? "png" : "jpg";
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${payment.order.orderNumber}.${extension}"`,
        "Content-Type": payment.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
