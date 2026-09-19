import { describe, expect, it } from "vitest";
import { createCsv } from "@/lib/csv";

describe("createCsv", () => {
  it("adds an Excel-compatible BOM and escapes quotes, commas and newlines", () => {
    expect(createCsv([["ชื่อ", "หมายเหตุ"], ["สมชาย, ใจดี", "บรรทัด 1\n\"บรรทัด 2\""]]))
      .toBe('\uFEFF"ชื่อ","หมายเหตุ"\r\n"สมชาย, ใจดี","บรรทัด 1\n""บรรทัด 2"""\r\n');
  });

  // เคสสำคัญด้านความปลอดภัย ข้อมูลในไฟล์มาจากที่ผู้ใช้กรอก ต้องไม่กลายเป็นสูตรที่รันได้ตอนเปิดใน Excel
  it("neutralizes spreadsheet formulas", () => {
    expect(createCsv([["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "normal"]]))
      .toBe('\uFEFF"\'=1+1","\'+SUM(A1:A2)","\'-2+3","\'@cmd","normal"\r\n');
  });
});
