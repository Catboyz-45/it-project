import { describe, expect, it } from "vitest";
import { meetsPasswordPolicy, newPasswordSchema, passwordRules } from "@/lib/domain/password-policy";

describe("password policy", () => {
  it("accepts a password that meets every rule", () => {
    expect(newPasswordSchema.safeParse("NestlyHome2026").success).toBe(true);
    expect(meetsPasswordPolicy("NestlyHome2026")).toBe(true);
  });

  it.each([
    ["Short1A", "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร"],
    ["nestlyhome2026", "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่"],
    ["NESTLYHOME2026", "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก"],
    ["NestlyHomeTwo", "รหัสผ่านต้องมีตัวเลข"],
  ])("rejects %s with a message naming the missing rule", (value, message) => {
    const result = newPasswordSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
  });

  it("rejects passwords longer than the hashing limit", () => {
    expect(newPasswordSchema.safeParse(`Aa1${"x".repeat(126)}`).success).toBe(false);
  });

  // หน้าจอใช้กฎชุดเดียวกับเซิร์ฟเวอร์ ถ้าทุกข้อติ๊กถูก เซิร์ฟเวอร์ต้องรับแน่นอน
  it("keeps the on-screen checklist in step with the server schema", () => {
    for (const value of ["", "abc", "Abcdefghijk1", "ABCDEFGHIJKL", "Abcdefghijkl1"]) {
      const allRulesPass = passwordRules.every((rule) => rule.test(value));
      expect(newPasswordSchema.safeParse(value).success).toBe(allRulesPass);
    }
  });
});
