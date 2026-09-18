/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “csv.test” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { describe, expect, it } from "vitest";
import { createCsv } from "@/lib/csv";

describe("createCsv", () => {
  it("adds an Excel-compatible BOM and escapes quotes, commas and newlines", () => {
    expect(createCsv([["ชื่อ", "หมายเหตุ"], ["สมชาย, ใจดี", "บรรทัด 1\n\"บรรทัด 2\""]]))
      .toBe('\uFEFF"ชื่อ","หมายเหตุ"\r\n"สมชาย, ใจดี","บรรทัด 1\n""บรรทัด 2"""\r\n');
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(createCsv([["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "normal"]]))
      .toBe('\uFEFF"\'=1+1","\'+SUM(A1:A2)","\'-2+3","\'@cmd","normal"\r\n');
  });
});
