/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ form-validation.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { fieldMessage, readFieldErrors } from "@/lib/form-validation";

describe("form validation feedback", () => {
  it("รับเฉพาะข้อความผิดพลาดรายช่องจาก API", () => {
    expect(readFieldErrors({ fields: { slug: ["Invalid string"], title: [], unsafe: "no" } })).toEqual({ slug: ["Invalid string"] });
  });

  it("แปลงข้อความ validation ทั่วไปเป็นภาษาไทย", () => {
    expect(fieldMessage({ slug: ["Invalid string: must match pattern"] }, "slug")).toBe("รูปแบบข้อมูลไม่ถูกต้อง");
    expect(fieldMessage({ email: ["Invalid email"] }, "email")).toBe("กรุณากรอกอีเมลให้ถูกต้อง");
  });
});
