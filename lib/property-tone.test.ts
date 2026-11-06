import { describe, expect, it } from "vitest";
import { propertyTone, propertyTones } from "@/lib/property-tone";

describe("property tone", () => {
  // หอเดิมต้องได้สีเดิมทุกครั้ง ไม่งั้นผู้ใช้จำสีหอไม่ได้
  it("gives a property the same tone every time", () => {
    expect(propertyTone("cc744716b4623c1ba44bc3b53")).toBe(propertyTone("cc744716b4623c1ba44bc3b53"));
  });

  it("spreads properties across the palette", () => {
    const tones = new Set(Array.from({ length: 40 }, (_, index) => propertyTone(`property-${index}`)));
    expect(tones.size).toBe(propertyTones.length);
  });
});
