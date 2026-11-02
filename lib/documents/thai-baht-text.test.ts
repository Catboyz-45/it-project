import { describe, expect, it } from "vitest";
import { thaiBahtText } from "@/lib/documents/thai-baht-text";

describe("thaiBahtText", () => {
  it("reads common rent amounts the way Thai contracts write them", () => {
    expect(thaiBahtText(4500)).toBe("สี่พันห้าร้อยบาทถ้วน");
    expect(thaiBahtText(9000)).toBe("เก้าพันบาทถ้วน");
    expect(thaiBahtText(0)).toBe("ศูนย์บาทถ้วน");
  });

  it("applies the special readings for one and two", () => {
    expect(thaiBahtText(11)).toBe("สิบเอ็ดบาทถ้วน");
    expect(thaiBahtText(21)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(thaiBahtText(1)).toBe("หนึ่งบาทถ้วน");
    expect(thaiBahtText(101)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
    expect(thaiBahtText(10)).toBe("สิบบาทถ้วน");
  });

  it("reads millions and satang", () => {
    expect(thaiBahtText(1_250_000)).toBe("หนึ่งล้านสองแสนห้าหมื่นบาทถ้วน");
    expect(thaiBahtText(11_000_001)).toBe("สิบเอ็ดล้านหนึ่งบาทถ้วน");
    expect(thaiBahtText(1520.5)).toBe("หนึ่งพันห้าร้อยยี่สิบบาทห้าสิบสตางค์");
    expect(thaiBahtText(0.29)).toBe("ยี่สิบเก้าสตางค์");
  });

  it("returns an empty string for values a contract cannot contain", () => {
    expect(thaiBahtText(-1)).toBe("");
    expect(thaiBahtText(Number.NaN)).toBe("");
  });
});
