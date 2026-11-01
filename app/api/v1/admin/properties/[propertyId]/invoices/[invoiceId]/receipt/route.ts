import { NextRequest } from "next/server";
import { getPropertyReceiptData, receiptNumber } from "@/lib/documents/receipt-data";
import { renderDocumentPdf } from "@/lib/documents/service";
import { recordIdSchema } from "@/lib/domain/record-id";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { ApiError, apiErrorResponse, apiSuccessBinaryResponse } from "@/lib/server/api";
import { assertApiRateLimit } from "@/lib/server/api-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

type Context = { params: Promise<{ propertyId: string; invoiceId: string }> };

// ใบเสร็จ PDF ของบิลที่ชำระแล้ว สร้างใหม่จากข้อมูลจริงทุกครั้ง ไม่ได้เก็บไฟล์ไว้
// เป็นการอ่านอย่างเดียว หอที่แพ็กเกจหมดอายุจึงยังออกใบเสร็จของบิลเดิมได้
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, params.propertyId);
    await assertApiRateLimit(request, "document", "receipt");
    const invoiceId = recordIdSchema.safeParse(params.invoiceId);
    if (!invoiceId.success) throw new ApiError(404, "ไม่พบบิล");
    const { data } = await getPropertyReceiptData(propertyId, invoiceId.data);
    const { pdf } = await renderDocumentPdf(propertyId, "receipt", data);
    return apiSuccessBinaryResponse(
      request,
      new Uint8Array(pdf),
      { headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${receiptNumber(data.invoice_number)}.pdf"`, "Content-Type": "application/pdf", "X-Content-Type-Options": "nosniff" } },
      { userId: auth.userId, propertyId, action: "RECEIPT_DOWNLOAD", targetType: "Invoice", targetId: invoiceId.data },
    );
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
