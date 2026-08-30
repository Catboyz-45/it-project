/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ cms-business-rules.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import { ContentStatus } from "@prisma/client";
import { canTransition, newsPublicationDate, retentionDate } from "@/server/cms/rules";
import { productSchema, projectSchema, serviceSchema } from "@/server/cms/schemas";

describe("CMS business rules", () => {
  it("allows only the complete explicit content transition matrix", () => {
    const expected = {
      DRAFT: { DRAFT: true, PUBLISHED: true, ARCHIVED: true },
      PUBLISHED: { DRAFT: true, PUBLISHED: true, ARCHIVED: true },
      ARCHIVED: { DRAFT: true, PUBLISHED: false, ARCHIVED: true },
    } as const;

    for (const from of Object.values(ContentStatus)) {
      for (const to of Object.values(ContentStatus)) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected[from][to]);
      }
    }
  });
  it("calculates retention at exactly 30 days", () => {
    const now = new Date("2026-08-01T00:00:00.000Z");
    expect(retentionDate(now).toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });
  it("preserves the 30-day boundary across leap-day and DST calendar changes", () => {
    const leapDay = new Date("2028-02-29T23:30:00.000Z");
    expect(retentionDate(leapDay).getTime() - leapDay.getTime()).toBe(30 * 86_400_000);
    expect(retentionDate(leapDay).toISOString()).toBe("2028-03-30T23:30:00.000Z");
  });
  it("rejects invalid slugs and inverted BTU ranges", () => {
    expect(serviceSchema.safeParse({ slug: "ไม่ถูก", title: "x", summary: "x" }).success).toBe(false);
    expect(productSchema.safeParse({ slug: "test", name: "x", model: "x", summary: "x", brandId: "b", productTypeId: "t", btuMin: 18000, btuMax: 9000 }).success).toBe(false);
  });
  it("requires a customer name when disclosure is enabled", () => {
    expect(projectSchema.safeParse({ slug: "project", title: "x", projectType: "x", area: "x", summary: "x", showCustomerName: true }).success).toBe(false);
  });
  it("preserves a scheduled news date for drafts and published content", () => {
    const scheduled = new Date("2026-11-01T02:00:00.000Z");
    expect(newsPublicationDate(scheduled, ContentStatus.DRAFT)).toEqual(scheduled);
    expect(newsPublicationDate(scheduled, ContentStatus.PUBLISHED)).toEqual(scheduled);
    expect(newsPublicationDate(null, ContentStatus.DRAFT)).toBeNull();
  });
});
