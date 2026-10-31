import { describe, expect, it } from "vitest";
import { platformPaymentSettingsSchema } from "@/lib/domain/payment-account";
import { updatePropertySettingsSchema } from "@/lib/domain/property-management";

const baseSettings = {
  address: "กรุงเทพฯ", contactPhone: "021234567", waterUnitRate: 18, electricityUnitRate: 7.5,
  billingDay: 1, dueDay: 5, lateFeePerDay: 0, invoicePrefix: "INV",
};

describe("payment accounts", () => {
  // คนพิมพ์เลขบัญชีตามที่เห็นในสมุดบัญชี มีขีดมีเว้นวรรค เก็บแค่ตัวเลขเพื่อให้แสดงผลแบบเดียวกันทุกที่
  it("stores bank account numbers as digits only", () => {
    const parsed = platformPaymentSettingsSchema.parse({ bankName: "กสิกรไทย", bankAccountNumber: "123-4-56789 0", bankAccountName: "Nestly" });
    expect(parsed.bankAccountNumber).toBe("1234567890");
  });

  it("rejects account numbers that are too short or contain letters", () => {
    expect(platformPaymentSettingsSchema.safeParse({ bankName: "กสิกรไทย", bankAccountNumber: "12345", bankAccountName: "Nestly" }).success).toBe(false);
    expect(platformPaymentSettingsSchema.safeParse({ bankName: "กสิกรไทย", bankAccountNumber: "12345abcde", bankAccountName: "Nestly" }).success).toBe(false);
  });

  // บัญชีที่กรอกไม่ครบโอนไม่ได้จริง จึงต้องครบทั้งสามช่องหรือว่างทั้งหมด ใช้กฎเดียวกันทั้งหอและแพลตฟอร์ม
  it("requires bank name, number and holder together", () => {
    expect(platformPaymentSettingsSchema.safeParse({ bankName: "กสิกรไทย" }).success).toBe(false);
    expect(updatePropertySettingsSchema.safeParse({ ...baseSettings, bankAccountNumber: "1234567890" }).success).toBe(false);
    expect(updatePropertySettingsSchema.safeParse({ ...baseSettings, bankName: null, bankAccountNumber: null, bankAccountName: null }).success).toBe(true);
    expect(platformPaymentSettingsSchema.safeParse({ promptPayId: "0812345678" }).success).toBe(true);
  });

  it("rejects unknown fields on the platform settings", () => {
    expect(platformPaymentSettingsSchema.safeParse({ promptPayId: "0812345678", isAdmin: true }).success).toBe(false);
  });
});
