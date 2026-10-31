import { describe, expect, it } from "vitest";
import { recordIdSchema, userIdSchema } from "@/lib/domain/record-id";

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

  // บัญชีที่ admin:bootstrap สร้างใช้ UUID ต้องจัดการผ่านเมนูของ Super Admin ได้เหมือนบัญชีอื่น
  it("accepts both cuid and UUID user ids", () => {
    expect(userIdSchema.safeParse("cmh1k2x8f0000abcd1234efgh").success).toBe(true);
    expect(userIdSchema.safeParse("2f5ec984-4f48-48fe-ab6c-763a9272a96f").success).toBe(true);
    for (const value of ["", "not-a-uuid", "2f5ec984-4f48-48fe-ab6c", "../2f5ec984"]) {
      expect(userIdSchema.safeParse(value).success, value).toBe(false);
    }
  });
});
