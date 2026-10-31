import { describe, expect, it } from "vitest";
import {
  isValidIdentityDocumentNumber,
  isValidThaiNationalId,
  normalizeIdentityDocumentNumber,
} from "@/lib/domain/identity-document";

describe("identity document numbers", () => {
  it("strips spaces and dashes and uppercases passport letters", () => {
    expect(normalizeIdentityDocumentNumber("1-1017-00230-70-8")).toBe("1101700230708");
    expect(normalizeIdentityDocumentNumber(" aa 1234567 ")).toBe("AA1234567");
  });

  it("accepts a Thai national ID only when the check digit matches", () => {
    expect(isValidThaiNationalId("1101700230708")).toBe(true);
    expect(isValidThaiNationalId("3101500123459")).toBe(true);
    // เปลี่ยนหลักสุดท้ายหลักเดียว เลขตรวจสอบต้องไม่ผ่าน
    expect(isValidThaiNationalId("1101700230709")).toBe(false);
    expect(isValidThaiNationalId("110170023070")).toBe(false);
  });

  it("treats 13 digits as a national ID and anything else as a passport", () => {
    expect(isValidIdentityDocumentNumber("1-1017-00230-70-8")).toBe(true);
    expect(isValidIdentityDocumentNumber("1101700230709")).toBe(false);
    expect(isValidIdentityDocumentNumber("AA1234567")).toBe(true);
    expect(isValidIdentityDocumentNumber("12345")).toBe(false);
    expect(isValidIdentityDocumentNumber("AB12<script>")).toBe(false);
    expect(isValidIdentityDocumentNumber("A".repeat(21))).toBe(false);
  });
});
