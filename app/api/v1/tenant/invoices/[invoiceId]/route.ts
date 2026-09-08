/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็น API GET ที่ URL /api/v1/tenant/invoices/[invoiceId] สำหรับผู้เช่า
 * การทำงาน: รับคำขอจากหน้าเว็บ ตรวจข้อมูลและสิทธิ์บนเซิร์ฟเวอร์ เรียก business service ที่เกี่ยวข้อง แล้วคืนผลลัพธ์หรือข้อผิดพลาดรูปแบบมาตรฐาน
 */

import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api";
import { canAccessTenantFinancialRecords, parseTenantRecordId, requireActiveTenant, requireOwnedInvoice } from "@/lib/server/tenant-auth";

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
    if (!canAccessTenantFinancialRecords(occupancy.role, "ACTIVE")) {
      return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
    }
    const id = parseTenantRecordId((await context.params).invoiceId);
    const invoice = await requireOwnedInvoice(auth.tenantProfileId, id);
    return NextResponse.json({
      data: {
        ...invoice,
        subtotal: invoice.subtotal.toString(),
        lateFee: invoice.lateFee.toString(),
        total: invoice.total.toString(),
        items: invoice.items.map((item) => ({
          ...item,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          amount: item.amount.toString(),
        })),
      },
    });
  } catch (error) { return apiErrorResponse(error, request); }
}
