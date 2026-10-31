import { describe, expect, it } from "vitest";
import { recordIdSchema } from "@/lib/domain/record-id";

describe("record id", () => {
  it("accepts ids in the format Prisma generates", () => {
    expect(recordIdSchema.safeParse("cmh1k2x8f0000abcd1234efgh").success).toBe(true);
  });

  // id มาจาก URL ที่ผู้ใช้แก้เองได้ ต้องปฏิเสธรูปแบบอื่นทั้งหมดก่อนไปถึงฐานข้อมูล
  it("rejects anything else", () => {
    for (const value of ["", "not-a-cuid", "c123", "x".repeat(25), "c abcdefgh", "c../../etc", "CMH1K2X8F0000ABCD"]) {
      expect(recordIdSchema.safeParse(value).success, value).toBe(false);
    }
  });
});
