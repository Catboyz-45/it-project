import type { Prisma } from "@/generated/prisma/client";
import type { ReceiptDocumentData } from "@/lib/documents/placeholders";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

// ใบเสร็จต้องประกอบจากบิลในฐานข้อมูลเท่านั้น ไม่รับยอดจากฝั่งเบราว์เซอร์ จะได้ปลอมยอดในใบเสร็จไม่ได้
const receiptInvoiceSelect = {
  invoiceNumber: true, billingMonth: true, status: true, paidAt: true, lateFee: true, total: true,
  property: { select: { name: true } },
  room: {
    select: {
      number: true,
      occupancies: {
        where: { role: "PRIMARY" as const, status: "ACTIVE" as const },
        take: 1,
        select: { tenantProfile: { select: { user: { select: { displayName: true } } } } },
      },
    },
  },
  items: { select: { type: true, amount: true } },
  // สลิปที่อนุมัติล่าสุดบอกว่าใครโอนมาและโอนเมื่อไหร่ บิลที่เจ้าของหอกดรับเงินเองจะไม่มีส่วนนี้
  paymentSubmissions: {
    where: { status: "APPROVED" as const },
    orderBy: { reviewedAt: "desc" as const },
    take: 1,
    select: { reviewedAt: true, tenantProfile: { select: { user: { select: { displayName: true } } } } },
  },
} satisfies Prisma.InvoiceSelect;

type ReceiptInvoice = Prisma.InvoiceGetPayload<{ select: typeof receiptInvoiceSelect }>;

// เลขใบเสร็จผูกกับเลขบิล บิลหนึ่งใบมีใบเสร็จได้ใบเดียว ออกซ้ำกี่ครั้งก็ได้เลขเดิม
export function receiptNumber(invoiceNumber: string) {
  return `RC-${invoiceNumber}`;
}

// แปลงบิลที่ชำระแล้วเป็นข้อมูลใบเสร็จ แยกเป็นฟังก์ชันล้วน ทดสอบได้โดยไม่ต้องมีฐานข้อมูล
export function buildReceiptData(invoice: ReceiptInvoice): ReceiptDocumentData {
  if (invoice.status !== "PAID") throw new ApiError(409, "ออกใบเสร็จได้เฉพาะบิลที่ชำระแล้ว");
  const amount = (types: string[]) => invoice.items
    .filter((item) => types.includes(item.type))
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const approvedSlip = invoice.paymentSubmissions[0];
  const paidAt = invoice.paidAt ?? approvedSlip?.reviewedAt ?? new Date();
  return {
    reference_id: receiptNumber(invoice.invoiceNumber),
    invoice_number: invoice.invoiceNumber,
    property_name: invoice.property.name,
    room_number: invoice.room.number,
    // คนที่ส่งสลิปคือคนจ่ายจริง ไม่มีสลิปก็ใช้ผู้เช่าหลักของห้อง
    tenant_name: approvedSlip?.tenantProfile.user.displayName
      ?? invoice.room.occupancies[0]?.tenantProfile.user.displayName
      ?? "ผู้เช่าห้อง " + invoice.room.number,
    billing_month: invoice.billingMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }),
    // วันที่ตามเวลาไทย ชำระตอนตีหนึ่งของไทยจะได้ไม่กลายเป็นวันก่อนหน้าตาม UTC
    paid_date: new Date(paidAt.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
    payment_method: approvedSlip ? "โอนเงิน (ตรวจหลักฐานแล้ว)" : "ชำระกับหอพัก",
    rent_amount: amount(["RENT"]),
    water_amount: amount(["WATER"]),
    electricity_amount: amount(["ELECTRICITY"]),
    service_amount: amount(["SERVICE", "OTHER"]),
    late_fee_amount: Number(invoice.lateFee),
    total_amount: Number(invoice.total),
  };
}

// ใบเสร็จของบิลในหอนี้ ใส่ propertyId ไว้ในเงื่อนไขเลย เจ้าของหอขอใบเสร็จของหออื่นไม่ได้
export async function getPropertyReceiptData(propertyId: string, invoiceId: string) {
  const invoice = await getDatabase().invoice.findFirst({ where: { id: invoiceId, propertyId }, select: receiptInvoiceSelect });
  if (!invoice) throw new ApiError(404, "ไม่พบบิล");
  return { propertyId, data: buildReceiptData(invoice) };
}

// ใบเสร็จฝั่งผู้เช่า เห็นได้เฉพาะผู้เช่าหลักที่ยังพักอยู่ในห้องของบิลนั้น เหมือนสิทธิ์ดูบิล
export async function getTenantReceiptData(tenantProfileId: string, invoiceId: string) {
  const invoice = await getDatabase().invoice.findFirst({
    where: { id: invoiceId, room: { occupancies: { some: { tenantProfileId, role: "PRIMARY", status: "ACTIVE" } } } },
    select: { propertyId: true, ...receiptInvoiceSelect },
  });
  if (!invoice) throw new ApiError(404, "ไม่พบข้อมูล");
  return { propertyId: invoice.propertyId, data: buildReceiptData(invoice) };
}

// ตัวอย่างใบเสร็จในหน้าแก้ Template ใช้บิลที่ชำระล่าสุดของหอ เจ้าของหอจะได้เห็นกับข้อมูลจริงของตัวเอง
export async function getReceiptPreviewData(propertyId: string) {
  const invoice = await getDatabase().invoice.findFirst({
    where: { propertyId, status: "PAID" },
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
    select: receiptInvoiceSelect,
  });
  if (!invoice) throw new ApiError(409, "กรุณารับชำระบิลอย่างน้อยหนึ่งใบก่อนดูตัวอย่างใบเสร็จ");
  return buildReceiptData(invoice);
}
