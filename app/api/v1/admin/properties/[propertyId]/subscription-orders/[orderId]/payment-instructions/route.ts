import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { recordIdSchema } from "@/lib/domain/record-id";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { requireAdminProperty } from "@/lib/server/admin-property-api";
import { getSubscriptionPaymentInstructions } from "@/lib/server/payment-accounts";

type Context = { params: Promise<{ propertyId: string; orderId: string }> };

// วิธีโอนค่าแพ็กเกจของคำสั่งซื้อที่รอชำระ บัญชีของแพลตฟอร์ม และ QR พร้อมเพย์ตรงยอด
// ?format=png คืนรูป QR ให้แท็ก img ใช้ได้เลย ไม่ต้องลง library สร้าง QR ฝั่งเบราว์เซอร์
export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    const { propertyId } = await requireAdminProperty(request, params.propertyId);
    const orderId = recordIdSchema.safeParse(params.orderId);
    if (!orderId.success) throw new ApiError(404, "ไม่พบคำสั่งซื้อที่รอชำระ");
    const instructions = await getSubscriptionPaymentInstructions(propertyId, orderId.data);
    if (request.nextUrl.searchParams.get("format") !== "png") return NextResponse.json({ data: instructions });
    if (!instructions.promptPayPayload) throw new ApiError(404, "ยังไม่ได้ตั้งค่าพร้อมเพย์รับค่าแพ็กเกจ");
    const image = await QRCode.toBuffer(instructions.promptPayPayload, {
      type: "png", width: 512, margin: 2, errorCorrectionLevel: "M",
    });
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="promptpay-${instructions.orderNumber.replace(/[^A-Za-z0-9_-]/g, "-")}.png"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
