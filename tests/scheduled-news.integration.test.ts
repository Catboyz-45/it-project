/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ scheduled-news.integration.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ContentService } from "@/server/cms/content.service";
import { NewsRepository } from "@/server/repositories/content.repository";

const suite = describe.runIf(process.env.RUN_INTEGRATION === "1");
const slug = `scheduled-${randomUUID().slice(0, 8)}`;
let id = "";

suite("scheduled news", () => {
  beforeAll(async () => {
    const [admin, category] = await Promise.all([
      db.admin.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } }),
      db.newsCategory.findFirstOrThrow({ where: { isActive: true, deletedAt: null }, select: { id: true } }),
    ]);
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const record = await new ContentService().create("news", { slug, title: "ข่าวกำหนดเวลา (ทดสอบ)", summary: "ข้อมูลทดสอบ", categoryId: category.id, status: "DRAFT", publishedAt: scheduledAt }, { id: admin.id, role: "SUPER_ADMIN" }, {});
    id = record.id;
  });

  afterAll(async () => {
    if (id) {
      await db.auditLog.deleteMany({ where: { targetId: id } });
      await db.news.deleteMany({ where: { id } });
    }
    await db.$disconnect();
  });

  it("keeps the requested date and hides the article until that time", async () => {
    const service = new ContentService();
    const draft = await service.get("news", id);
    expect(draft?.publishedAt).toBeInstanceOf(Date);
    await service.transition("news", id, "publish", { id: (await db.admin.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } })).id, role: "SUPER_ADMIN" }, {});
    const scheduled = await service.get("news", id);
    expect(scheduled?.status).toBe("PUBLISHED");
    expect(scheduled?.publishedAt).toEqual(draft?.publishedAt);
    expect((await new NewsRepository().listPublished({ query: slug, pageSize: 20 })).items).toHaveLength(0);
  });
});
