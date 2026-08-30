/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ cms-audit.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { CmsError } from "@/server/cms/errors";
import { cmsAuditErrorCode } from "@/server/cms/http";

describe("CMS failure audit classification", () => {
  it("classifies validation and business-rule failures without exposing messages", () => {
    const validation = z.object({ title: z.string().min(1) }).safeParse({ title: "" });
    expect(validation.success).toBe(false);
    if (!validation.success) expect(cmsAuditErrorCode(validation.error)).toBe("VALIDATION_ERROR");
    expect(cmsAuditErrorCode(new CmsError("INVALID_TRANSITION", "รายละเอียดภายใน"))).toBe("INVALID_TRANSITION");
  });

  it("uses stable database and internal error codes", () => {
    const databaseError = new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
    expect(cmsAuditErrorCode(databaseError)).toBe("P2002");
    expect(cmsAuditErrorCode(new Error("secret detail"))).toBe("INTERNAL_ERROR");
  });
});
