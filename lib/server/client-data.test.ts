import { describe, expect, it } from "vitest";
import { toClientData } from "@/lib/server/client-data";

describe("client data conversion", () => {
  // Client Component รับได้แค่ค่าธรรมดา วันที่ต้องกลายเป็นสตริง ISO และเลขทศนิยมของ Prisma ต้องกลายเป็นสตริง
  it("turns dates and decimal-like values into plain JSON", () => {
    const decimal = { toJSON: () => "3500.00" };
    const result = toClientData<{ at: string; rent: string; nested: { list: number[] } }>({
      at: new Date("2026-01-02T03:04:05.000Z"),
      rent: decimal,
      nested: { list: [1, 2] },
    });
    expect(result).toEqual({ at: "2026-01-02T03:04:05.000Z", rent: "3500.00", nested: { list: [1, 2] } });
  });

  it("drops undefined fields and keeps a missing value as undefined", () => {
    expect(toClientData({ a: 1, b: undefined })).toEqual({ a: 1 });
    expect(toClientData(undefined)).toBeUndefined();
  });
});
