import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { apiErrorResponse } from "@/lib/server/api";
import { parseTenantRecordId, requireActiveTenant } from "@/lib/server/tenant-auth";
import { getTenantPromptPay } from "@/lib/server/payments";
import { requireSubscriptionFeature } from "@/lib/server/saas";
type Context = { params: Promise<{ invoiceId: string }> };
// สร้างข้อความ QR พร้อมเพย์ให้จ่ายตรงยอด
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
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
