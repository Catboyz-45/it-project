import { describe, expect, it } from "vitest";
import { phoneNumberSchema } from "@/lib/domain/phone";
import { updateOwnTenantProfileSchema } from "@/lib/domain/tenant-account";

describe("phone number validation", () => {
  it("accepts Thai numbers written with dashes, spaces or a country code", () => {
    for (const phone of ["0891234567", "089-123-4567", "02 123 4567", "+66891234567"]) {
      expect(phoneNumberSchema.parse(phone)).toBe(phone);
    }
  });

  it("rejects letters and numbers that are too short", () => {
    for (const phone of ["abcdefghij", "08x1234567", "1234-567", "--------"]) {
      expect(phoneNumberSchema.safeParse(phone).success).toBe(false);
    }
  });

  it("checks the optional emergency phone only when one is given", () => {
    const base = { displayName: "สมชาย ใจดี", phone: "0891234567", address: "", emergencyName: "" };
    expect(updateOwnTenantProfileSchema.parse({ ...base, emergencyPhone: "" }).emergencyPhone).toBeNull();
    expect(updateOwnTenantProfileSchema.safeParse({ ...base, emergencyPhone: "abcdefgh" }).success).toBe(false);
  });
});
