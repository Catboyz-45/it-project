import { NextRequest, NextResponse } from "next/server";
import { getTenantReceiptData, receiptNumber } from "@/lib/documents/receipt-data";
import { renderDocumentPdf } from "@/lib/documents/service";
import { apiErrorResponse, apiSuccessBinaryResponse } from "@/lib/server/api";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";
import { canAccessTenantFinancialRecords, parseTenantRecordId, requireActiveTenant } from "@/lib/server/tenant-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

type Context = { params: Promise<{ invoiceId: string }> };

// ใบเสร็จ PDF ของบิลที่ผู้เช่าชำระแล้ว ตรวจความเป็นเจ้าของบิลในคำสั่งฐานข้อมูลเลย เหมือนตอนดูบิล
export async function GET(request: NextRequest, context: Context) {
  try {
    const { auth, occupancy } = await requireActiveTenant(request);
    // ผู้พักร่วมไม่เห็นข้อมูลการเงิน ตอบว่าไม่พบ ไม่บอกว่าไม่มีสิทธิ์
    if (!canAccessTenantFinancialRecords(occupancy.role, "ACTIVE")) {
      return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
    }
    await assertApiRateLimit(request, "document", "receipt");
    const invoiceId = parseTenantRecordId((await context.params).invoiceId);
    const { propertyId, data } = await getTenantReceiptData(auth.tenantProfileId, invoiceId);
    const { pdf } = await renderDocumentPdf(propertyId, "receipt", data);
    return apiSuccessBinaryResponse(
      request,
      new Uint8Array(pdf),
      { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${receiptNumber(data.invoice_number)}.pdf"`, "Content-Type": "application/pdf", "X-Content-Type-Options": "nosniff" } },
      { userId: auth.userId, propertyId, action: "RECEIPT_DOWNLOAD", targetType: "Invoice", targetId: invoiceId },
    );
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
