/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/tenant/invoices/[invoiceId]/promptpay-qr สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { apiErrorResponse } from "@/lib/server/api";
import { parseTenantRecordId, requireActiveTenant } from "@/lib/server/tenant-auth";
import { getTenantPromptPay } from "@/lib/server/payments";
import { requireSubscriptionFeature } from "@/lib/server/saas";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Context = { params: Promise<{ invoiceId: string }> };
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
    const { auth, occupancy } = await requireActiveTenant(request);
    await requireSubscriptionFeature(occupancy.propertyId, "allowPromptPay");
    if (occupancy.role !== "PRIMARY") return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
    const invoiceId = parseTenantRecordId((await context.params).invoiceId);
    const promptPay = await getTenantPromptPay(auth.tenantProfileId, invoiceId);
    if (request.nextUrl.searchParams.get("format") === "json") {
      return NextResponse.json({ data: promptPay });
    }
    const image = await QRCode.toBuffer(promptPay.payload, {
      type: "png", width: 512, margin: 2, errorCorrectionLevel: "M",
    });
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="promptpay-${promptPay.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "-")}.png"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
