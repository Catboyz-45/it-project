import { describe, expect, it } from "vitest";
import { assignPropertyTones, propertyTones } from "@/lib/property-tone";

describe("property tones", () => {
  // หอเดิมต้องได้สีเดิมทุกครั้ง ไม่ว่าจะแสดงลำดับไหน ไม่งั้นผู้ใช้จำสีหอไม่ได้
  it("gives the same properties the same tones in any order", () => {
    const ids = ["cc744716b4623c1ba44bc3b53", "cm000000000000000000024", "property-7"];
    const first = assignPropertyTones(ids);
    const reversed = assignPropertyTones([...ids].reverse());
    for (const id of ids) expect(reversed.get(id)).toBe(first.get(id));
  });

  // สองหอในเมนูเดียวกันต้องไม่ได้สีเดียวกัน ไม่งั้นแยกด้วยตาไม่ได้
  it("never repeats a tone while the palette has room", () => {
    const ids = Array.from({ length: propertyTones.length }, (_, index) => `property-${index}`);
    expect(new Set(assignPropertyTones(ids).values()).size).toBe(propertyTones.length);
  });

  it("still gives every property a tone past the palette size", () => {
    const ids = Array.from({ length: 9 }, (_, index) => `property-${index}`);
    expect(assignPropertyTones(ids).size).toBe(9);
  });
});
