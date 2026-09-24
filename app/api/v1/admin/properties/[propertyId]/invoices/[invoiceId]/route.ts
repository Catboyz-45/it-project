import { NextRequest } from "next/server";
import { z } from "zod";
import { cancelInvoiceSchema, issueInvoiceSchema } from "@/lib/domain/billing";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { cancelInvoice, issueInvoice } from "@/lib/server/invoices";

type Context = { params: Promise<{ propertyId: string; invoiceId: string }> };

// ออกบิลจากร่างหรือยกเลิกบิล ทั้งสองอย่างต้องส่ง version มาด้วย
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { propertyId: rawPropertyId, invoiceId: rawInvoiceId } = await context.params;
    const { auth, propertyId } = await requireAdminProperty(request, rawPropertyId);
    const invoiceId = z.cuid().parse(rawInvoiceId);
    const body: unknown = await request.json();
    const cancellation = cancelInvoiceSchema.safeParse(body);
    const data = cancellation.success
      ? await cancelInvoice(propertyId, invoiceId, cancellation.data.version, cancellation.data.reason)
      : await issueInvoice(propertyId, invoiceId, issueInvoiceSchema.parse(body).version);
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId,
      propertyId,
      action: cancellation.success ? "INVOICE_CANCEL" : "INVOICE_ISSUE",
      targetType: "Invoice",
      targetId: invoiceId,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
