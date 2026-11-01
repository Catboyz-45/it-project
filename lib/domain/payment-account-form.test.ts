import { describe, expect, it } from "vitest";
import {
  bankOptions,
  formatAccountNumber,
  formatPromptPayId,
  hasBankAccount,
  type PaymentAccountDraft,
  thaiBanks,
  toPaymentAccountPayload,
  validatePaymentAccount,
} from "@/lib/domain/payment-account-form";
import { platformPaymentSettingsSchema } from "@/lib/domain/payment-account";

const empty: PaymentAccountDraft = { bankName: "", bankAccountNumber: "", bankAccountName: "", promptPayId: "" };
const full: PaymentAccountDraft = { bankName: "ธนาคารกสิกรไทย", bankAccountNumber: "123-4-56789-0", bankAccountName: "บริษัท เนสต์ลี จำกัด", promptPayId: "081-234-5678" };

describe("payment account form", () => {
  it("formats account and PromptPay numbers the way Thai users read them", () => {
    expect(formatAccountNumber("1234567890")).toBe("123-4-56789-0");
    expect(formatAccountNumber("123 4567 890")).toBe("123-4-56789-0");
    expect(formatPromptPayId("0812345678")).toBe("081-234-5678");
    expect(formatPromptPayId("0105500000001")).toBe("0-1055-00000-00-1");
    // ยาวแปลก ๆ ปล่อยไว้ตามเดิม ไม่ทำข้อมูลหาย
    expect(formatPromptPayId("12345")).toBe("12345");
  });

  it("asks only for the bank fields that are missing once one of them is filled", () => {
    expect(validatePaymentAccount(empty)).toEqual({});
    expect(validatePaymentAccount({ ...empty, bankName: "ธนาคารกสิกรไทย" })).toEqual({
      bankAccountNumber: "กรอกเลขที่บัญชี",
      bankAccountName: "กรอกชื่อบัญชี",
    });
    expect(validatePaymentAccount({ ...empty, promptPayId: "0812345678" })).toEqual({});
  });

  it("rejects numbers the server would reject", () => {
    expect(validatePaymentAccount({ ...full, bankAccountNumber: "12345" }).bankAccountNumber).toBe("เลขบัญชีต้องเป็นตัวเลข 10-12 หลัก");
    expect(validatePaymentAccount({ ...full, promptPayId: "08-12" }).promptPayId).toBe("เลขพร้อมเพย์ต้องเป็นตัวเลข 10-15 หลัก");
  });

  it("sends digits only and null for empty fields, which the server schema accepts", () => {
    const payload = toPaymentAccountPayload(full);
    expect(payload).toEqual({ bankName: "ธนาคารกสิกรไทย", bankAccountNumber: "1234567890", bankAccountName: "บริษัท เนสต์ลี จำกัด", promptPayId: "0812345678" });
    expect(platformPaymentSettingsSchema.safeParse(payload).success).toBe(true);
    expect(toPaymentAccountPayload(empty)).toEqual({ bankName: null, bankAccountNumber: null, bankAccountName: null, promptPayId: null });
    expect(platformPaymentSettingsSchema.safeParse(toPaymentAccountPayload(empty)).success).toBe(true);
  });

  it("keeps a bank name typed before the list existed so it can still be selected", () => {
    expect(bankOptions("")).toEqual([...thaiBanks]);
    expect(bankOptions("กสิกรไทย")[0]).toBe("กสิกรไทย");
    expect(bankOptions("ธนาคารกสิกรไทย")).toHaveLength(thaiBanks.length);
  });

  it("treats the bank account as set up only when all three fields are filled", () => {
    expect(hasBankAccount(full)).toBe(true);
    expect(hasBankAccount({ ...full, bankAccountName: " " })).toBe(false);
  });
});
