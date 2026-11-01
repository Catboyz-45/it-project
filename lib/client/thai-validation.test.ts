import { describe, expect, it } from "vitest";
import { type FieldState, thaiValidationMessage } from "@/lib/client/thai-validation";

// สถานะตั้งต้นที่ผ่านทุกข้อ แล้วค่อยเปิดทีละข้อในแต่ละเคส
const valid: FieldState["validity"] = {
  valueMissing: false, typeMismatch: false, badInput: false, tooShort: false, tooLong: false,
  rangeUnderflow: false, rangeOverflow: false, stepMismatch: false, patternMismatch: false,
};
const input = (validity: Partial<FieldState["validity"]>, extra: Partial<FieldState> = {}): FieldState =>
  ({ validity: { ...valid, ...validity }, tag: "input", type: "text", ...extra });

describe("Thai form validation messages", () => {
  it("explains missing values by field type", () => {
    expect(thaiValidationMessage(input({ valueMissing: true }))).toBe("กรุณากรอกช่องนี้");
    expect(thaiValidationMessage(input({ valueMissing: true }, { type: "file" }))).toBe("กรุณาเลือกไฟล์");
    expect(thaiValidationMessage(input({ valueMissing: true }, { type: "checkbox" }))).toBe("กรุณาติ๊กช่องนี้ก่อนดำเนินการต่อ");
    expect(thaiValidationMessage({ validity: { ...valid, valueMissing: true }, tag: "select" })).toBe("กรุณาเลือกตัวเลือก");
  });

  it("explains format, length and range problems", () => {
    expect(thaiValidationMessage(input({ typeMismatch: true }, { type: "email" }))).toBe("รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com");
    expect(thaiValidationMessage(input({ tooShort: true }, { minLength: 8 }))).toBe("กรุณากรอกอย่างน้อย 8 ตัวอักษร");
    expect(thaiValidationMessage(input({ rangeUnderflow: true }, { type: "number", min: "0" }))).toBe("ต้องไม่น้อยกว่า 0");
    expect(thaiValidationMessage(input({ rangeOverflow: true }, { type: "number", max: "10000" }))).toBe("ต้องไม่เกิน 10,000");
    expect(thaiValidationMessage(input({ patternMismatch: true }, { title: "เลขบัญชี 10-12 หลัก" }))).toBe("เลขบัญชี 10-12 หลัก");
    expect(thaiValidationMessage(input({}))).toBe("");
  });
});
