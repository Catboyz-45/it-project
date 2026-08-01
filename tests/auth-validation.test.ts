import { describe, expect, it } from "vitest";
import { loginSchema, otpSchema, passwordSchema, recoverySchema } from "@/server/auth/validation";

describe("authentication validation", () => {
  it("normalizes valid login input", () => { expect(loginSchema.parse({ username: " owner ", password: "temporary-password" }).username).toBe("owner"); });
  it("rejects unexpected login fields", () => { expect(loginSchema.safeParse({ username: "owner", password: "temporary-password", role: "SUPER_ADMIN" }).success).toBe(false); });
  it("requires exactly six OTP digits", () => { expect(otpSchema.safeParse({ code: "123456" }).success).toBe(true); expect(otpSchema.safeParse({ code: "12345a" }).success).toBe(false); });
  it("requires a strong matching password", () => { expect(passwordSchema.safeParse({ password: "Correct-Horse1!", confirm: "Correct-Horse1!" }).success).toBe(true); expect(passwordSchema.safeParse({ password: "weakpassword", confirm: "weakpassword" }).success).toBe(false); });
  it("bounds recovery input", () => { expect(recoverySchema.safeParse({ code: "ABCD-EFGH-IJKL" }).success).toBe(true); expect(recoverySchema.safeParse({ code: "x" }).success).toBe(false); });
});
