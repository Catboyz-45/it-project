/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “billing.test” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { describe, expect, it } from "vitest";
import { calculateDueDate, calculateInvoice, calculateLateFee, generateInvoiceSchema, meterReadingInputSchema } from "@/lib/domain/billing";

describe("billing rules", () => {
  it("calculates rent and metered utilities with two-decimal rounding", () => {
    const result = calculateInvoice({
      monthlyRent: 3000,
      water: { units: 7.5, unitRate: 10, meterReadingId: "water" },
      electricity: { units: 12.345, unitRate: 8, meterReadingId: "electric" },
    });
    expect(result.subtotal).toBe(3173.76);
    expect(result.lines).toHaveLength(3);
  });

  it("moves due date to next month when due day precedes billing day", () => {
    expect(calculateDueDate(new Date("2026-07-01T00:00:00Z"), 28, 5).toISOString().slice(0, 10)).toBe("2026-08-05");
  });

  it("rejects malformed billing months and negative readings", () => {
    expect(meterReadingInputSchema.safeParse({
      roomId: "cm12345678901234567890123", type: "WATER",
      billingMonth: "2026-13", currentReading: -1,
    }).success).toBe(false);
  });

  it("calculates daily late fees with a cap", () => {
    expect(calculateLateFee(new Date("2026-07-05Z"), new Date("2026-07-10Z"), 20, 60)).toEqual({ daysLate: 5, fee: 60 });
  });

  it("creates invoices as drafts and rejects immediate issuing", () => {
    const input = { roomId: "cm12345678901234567890123", billingMonth: "2026-07" };
    expect(generateInvoiceSchema.parse(input).issueImmediately).toBe(false);
    expect(generateInvoiceSchema.safeParse({ ...input, issueImmediately: true }).success).toBe(false);
  });
});
