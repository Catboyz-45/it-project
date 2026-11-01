import { describe, expect, it } from "vitest";
import { defaultTemplates } from "@/lib/documents/default-templates";
import { receiptDataSchema } from "@/lib/documents/placeholders";
import { buildReceiptData, receiptNumber } from "@/lib/documents/receipt-data";
import { renderTemplate, validateTemplatePlaceholders } from "@/lib/documents/templates";

// บิลจำลองหน้าตาเดียวกับที่ดึงจากฐานข้อมูล ใช้ทดสอบการแปลงเป็นใบเสร็จโดยไม่ต้องมีฐานข้อมูล
function paidInvoice(overrides: Partial<Parameters<typeof buildReceiptData>[0]> = {}) {
  return {
    invoiceNumber: "INV-2026-10-101",
    billingMonth: new Date("2026-10-01T00:00:00.000Z"),
    status: "PAID" as const,
    // ตีหนึ่งของวันที่ 6 ตามเวลาไทย ยังเป็นวันที่ 5 ตาม UTC
    paidAt: new Date("2026-11-05T18:00:00.000Z"),
    lateFee: { toString: () => "50" },
    total: { toString: () => "5416" },
    property: { name: "หอทดสอบ" },
    room: { number: "101", occupancies: [{ tenantProfile: { user: { displayName: "ผู้เช่าหลัก" } } }] },
    items: [
      { type: "RENT" as const, amount: { toString: () => "4500" } },
      { type: "WATER" as const, amount: { toString: () => "162" } },
      { type: "ELECTRICITY" as const, amount: { toString: () => "504" } },
      { type: "SERVICE" as const, amount: { toString: () => "200" } },
      { type: "LATE_FEE" as const, amount: { toString: () => "50" } },
    ],
    paymentSubmissions: [{ reviewedAt: new Date("2026-11-05T18:00:00.000Z"), tenantProfile: { user: { displayName: "ผู้โอนเงิน" } } }],
    ...overrides,
  } as unknown as Parameters<typeof buildReceiptData>[0];
}

describe("receipts", () => {
  it("builds receipt data from a paid invoice with the payer, Thai date and late fee", () => {
    const data = buildReceiptData(paidInvoice());
    expect(data).toMatchObject({
      reference_id: "RC-INV-2026-10-101",
      invoice_number: "INV-2026-10-101",
      tenant_name: "ผู้โอนเงิน",
      paid_date: "2026-11-06",
      payment_method: "โอนเงิน (ตรวจหลักฐานแล้ว)",
      rent_amount: 4500,
      water_amount: 162,
      electricity_amount: 504,
      service_amount: 200,
      late_fee_amount: 50,
      total_amount: 5416,
    });
    expect(receiptDataSchema.safeParse(data).success).toBe(true);
  });

  it("falls back to the primary tenant when the owner recorded the payment without a slip", () => {
    const data = buildReceiptData(paidInvoice({ paymentSubmissions: [] }));
    expect(data).toMatchObject({ tenant_name: "ผู้เช่าหลัก", payment_method: "ชำระกับหอพัก" });
  });

  it("refuses to issue a receipt for an unpaid invoice", () => {
    expect(() => buildReceiptData(paidInvoice({ status: "PENDING" }))).toThrow(expect.objectContaining({ status: 409 }));
  });

  it("ships a default receipt template that uses only receipt placeholders", () => {
    expect(validateTemplatePlaceholders("receipt", defaultTemplates.receipt.html)).toEqual([]);
    const html = renderTemplate("receipt", defaultTemplates.receipt.html, buildReceiptData(paidInvoice()));
    expect(html).toContain(receiptNumber("INV-2026-10-101"));
    expect(html).toContain("5,416.00");
    expect(html).not.toContain("{{");
  });
});
