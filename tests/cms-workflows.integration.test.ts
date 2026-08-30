/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ cms-workflows.integration.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { updateAdminSafely } from "@/server/auth/admin-users";
import { ContentService } from "@/server/cms/content.service";
import { TaxonomyService } from "@/server/cms/taxonomy.service";
import { companyInputSchema } from "@/server/services/company.service";
import { uploadRequestSchema } from "@/server/media/validation";

const suite = describe.runIf(process.env.RUN_INTEGRATION === "1");
const prefix = `cms-it-${randomUUID().slice(0, 8)}`;
const context = { requestId: `${prefix}-request`, ipHash: "integration-ip-hash", userAgent: "vitest-integration" };

function assertIsolatedTestDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required for integration tests");
  const name = decodeURIComponent(new URL(raw).pathname.replace(/^\//, ""));
  if (!/(test|e2e|sandbox)/i.test(name)) {
    throw new Error(`Refusing to run integration tests against non-test database: ${name}`);
  }
}

suite("CMS database integration workflows", () => {
  const content = new ContentService();
  const taxonomies = new TaxonomyService();
  let adminId = "";
  let companySnapshot: Awaited<ReturnType<typeof db.company.findUnique>>;
  let brandId = "";
  let productTypeId = "";
  let categoryId = "";
  let mediaId = "";
  const contentIds: string[] = [];

  beforeAll(async () => {
    assertIsolatedTestDatabase();
    companySnapshot = await db.company.findUnique({ where: { singletonKey: "PRIMARY" } });
    const username = `${prefix}-admin`;
    const admin = await db.admin.create({
      data: {
        username,
        usernameNormalized: username,
        displayName: "CMS Integration Admin",
        role: "SUPER_ADMIN",
        passwordHash: "integration-only-not-a-login-secret",
        mustChangePassword: false,
        twoFactorEnabled: true,
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { requestId: { startsWith: prefix } } });
    await db.product.deleteMany({ where: { id: { in: contentIds } } });
    await db.project.deleteMany({ where: { id: { in: contentIds } } });
    await db.news.deleteMany({ where: { id: { in: contentIds } } });
    await db.service.deleteMany({ where: { id: { in: contentIds } } });
    await db.banner.deleteMany({ where: { id: { in: contentIds } } });
    if (brandId) await db.brand.deleteMany({ where: { id: brandId } });
    if (productTypeId) await db.productType.deleteMany({ where: { id: productTypeId } });
    if (categoryId) await db.newsCategory.deleteMany({ where: { id: categoryId } });
    if (mediaId) await db.media.deleteMany({ where: { id: mediaId } });
    if (adminId) await db.admin.deleteMany({ where: { id: adminId } });
    if (companySnapshot) {
      const { id, createdAt, updatedAt, ...data } = companySnapshot;
      await db.company.upsert({
        where: { singletonKey: "PRIMARY" },
        create: { ...data, id },
        update: data,
      });
    }
    await db.$disconnect();
  });

  it("validates and persists Company API data and records its audit event", async () => {
    const input = companyInputSchema.parse({
      legalName: `บริษัททดสอบ ${prefix} จำกัด`,
      displayName: `บริษัททดสอบ ${prefix}`,
      shortDescription: "ข้อมูลสำหรับ integration test เท่านั้น",
      phoneDisplay: "02-000-0000",
      phoneHref: "+6620000000",
      email: "integration@example.test",
      lineUrl: "https://line.me/R/ti/p/@integration",
      logoMediaId: null,
    });
    const saved = await db.$transaction(async (tx) => {
      const company = await tx.company.upsert({
        where: { singletonKey: "PRIMARY" },
        create: { singletonKey: "PRIMARY", ...input },
        update: input,
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: adminId } },
          action: "COMPANY_UPDATED",
          targetType: "Company",
          targetId: company.id,
          result: "SUCCESS",
          requestId: context.requestId,
          userAgent: context.userAgent,
          metadata: { ipHash: context.ipHash },
        },
      });
      return company;
    });
    expect(saved).toMatchObject({ displayName: input.displayName, email: input.email });
    expect(await db.auditLog.findFirst({ where: { requestId: context.requestId, action: "COMPANY_UPDATED" } })).not.toBeNull();
  });

  it("creates, reads, updates, and lists every content type", async () => {
    const actor = { id: adminId, role: "SUPER_ADMIN" as const };
    const brand = await taxonomies.create("brands", { name: `${prefix} Brand`, slug: `${prefix}-brand`, sortOrder: 1, isActive: true }, actor, { ...context, requestId: `${prefix}-brand-create` });
    const type = await taxonomies.create("product-types", { name: `${prefix} Type`, slug: `${prefix}-type`, sortOrder: 1, isActive: true }, actor, { ...context, requestId: `${prefix}-type-create` });
    const category = await taxonomies.create("news-categories", { name: `${prefix} Category`, slug: `${prefix}-category`, sortOrder: 1, isActive: true }, actor, { ...context, requestId: `${prefix}-category-create` });
    brandId = brand.id; productTypeId = type.id; categoryId = category.id;

    const fixtures = [
      ["banners", { title: `${prefix} Banner`, description: "draft", imageId: null, sortOrder: 1, status: "DRAFT" }],
      ["services", { slug: `${prefix}-service`, title: `${prefix} Service`, summary: "service summary", coverMediaId: null, status: "DRAFT" }],
      ["products", { slug: `${prefix}-product`, name: `${prefix} Product`, model: `${prefix}-model`, summary: "product summary", brandId, productTypeId, galleryMediaIds: [], status: "DRAFT" }],
      ["projects", { slug: `${prefix}-project`, title: `${prefix} Project`, projectType: "HVAC", area: "Bangkok", summary: "project summary", galleryMediaIds: [], serviceIds: [], status: "DRAFT" }],
      ["news", { slug: `${prefix}-news`, title: `${prefix} News`, summary: "news summary", categoryId, coverMediaId: null, status: "DRAFT" }],
    ] as const;

    for (const [kind, input] of fixtures) {
      const created = await content.create(kind, input, actor, { ...context, requestId: `${prefix}-${kind}-create` });
      contentIds.push(created.id);
      expect(await content.get(kind, created.id)).not.toBeNull();
      const listed = await content.list(kind, { query: prefix, status: "ALL", page: 1, pageSize: 20, sort: "updated-desc" });
      expect(listed.items.some((item) => item.id === created.id)).toBe(true);
    }

    const serviceId = contentIds[1];
    const current = await content.get("services", serviceId);
    await content.update("services", serviceId, { slug: `${prefix}-service`, title: `${prefix} Service Updated`, summary: "updated summary", coverMediaId: null, status: "DRAFT" }, actor, { ...context, requestId: `${prefix}-service-update` }, current?.updatedAt.toISOString());
    expect(await content.get("services", serviceId)).toMatchObject({ title: `${prefix} Service Updated` });
  });

  it("publishes, unpublishes, trashes, restores, and permanently deletes content", async () => {
    const actor = { id: adminId, role: "SUPER_ADMIN" as const };
    const record = await content.create("services", { slug: `${prefix}-workflow`, title: `${prefix} Workflow`, summary: "workflow summary", coverMediaId: null, status: "DRAFT" }, actor, { ...context, requestId: `${prefix}-workflow-create` });
    contentIds.push(record.id);
    await content.transition("services", record.id, "publish", actor, { ...context, requestId: `${prefix}-publish` });
    expect(await content.get("services", record.id)).toMatchObject({ status: "PUBLISHED" });
    await content.transition("services", record.id, "unpublish", actor, { ...context, requestId: `${prefix}-unpublish` });
    expect(await content.get("services", record.id)).toMatchObject({ status: "DRAFT", publishedAt: null });
    await content.transition("services", record.id, "trash", actor, { ...context, requestId: `${prefix}-trash` });
    const trashed = await content.get("services", record.id, true);
    expect(trashed?.deletedAt).toBeInstanceOf(Date);
    expect(trashed?.purgeAt).toBeInstanceOf(Date);
    await content.transition("services", record.id, "restore", actor, { ...context, requestId: `${prefix}-restore` });
    expect(await content.get("services", record.id)).toMatchObject({ status: "DRAFT", deletedAt: null });
    await content.transition("services", record.id, "trash", actor, { ...context, requestId: `${prefix}-trash-again` });
    await content.transition("services", record.id, "delete", actor, { ...context, requestId: `${prefix}-delete` });
    expect(await content.get("services", record.id, true)).toBeNull();
  });

  it("covers taxonomy update, trash, restore, permanent deletion, and in-use protection", async () => {
    const actor = { id: adminId, role: "SUPER_ADMIN" as const };
    const taxonomy = await taxonomies.create("brands", { name: `${prefix} Disposable`, slug: `${prefix}-disposable`, sortOrder: 2, isActive: true }, actor, { ...context, requestId: `${prefix}-taxonomy-create` });
    await taxonomies.update("brands", taxonomy.id, { name: `${prefix} Disposable Updated`, slug: `${prefix}-disposable`, sortOrder: 3, isActive: true }, actor, { ...context, requestId: `${prefix}-taxonomy-update` });
    expect((await taxonomies.list("brands")).find((item) => item.id === taxonomy.id)?.sortOrder).toBe(3);
    await taxonomies.remove("brands", taxonomy.id, actor, { ...context, requestId: `${prefix}-taxonomy-trash` });
    expect(await db.brand.findUniqueOrThrow({ where: { id: taxonomy.id } })).toMatchObject({ isActive: false });
    await taxonomies.transition("brands", taxonomy.id, "restore", actor, { ...context, requestId: `${prefix}-taxonomy-restore` });
    await taxonomies.remove("brands", taxonomy.id, actor, { ...context, requestId: `${prefix}-taxonomy-trash-2` });
    await taxonomies.transition("brands", taxonomy.id, "delete", actor, { ...context, requestId: `${prefix}-taxonomy-delete` });
    expect(await db.brand.findUnique({ where: { id: taxonomy.id } })).toBeNull();
    await expect(taxonomies.remove("brands", brandId, actor, context)).rejects.toMatchObject({ code: "IN_USE" });
  });

  it("validates and persists upload metadata without contacting object storage", async () => {
    const metadata = uploadRequestSchema.parse({ filename: "../ทดสอบ.webp", mimeType: "image/webp", sizeBytes: 4096, altText: "ภาพทดสอบระบบ" });
    const media = await db.media.create({
      data: {
        kind: "IMAGE",
        objectKey: `media/integration/${prefix}.webp`,
        originalName: metadata.filename,
        mimeType: metadata.mimeType,
        sizeBytes: BigInt(metadata.sizeBytes),
        altText: metadata.altText,
        status: "UPLOADING",
        uploadExpiresAt: new Date(Date.now() + 15 * 60_000),
        orphanExpiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        uploadedById: adminId,
      },
    });
    mediaId = media.id;
    expect(media).toMatchObject({ kind: "IMAGE", status: "UPLOADING", mimeType: "image/webp", altText: "ภาพทดสอบระบบ", uploadedById: adminId });
    expect(Number(media.sizeBytes)).toBe(4096);
    expect(uploadRequestSchema.safeParse({ ...metadata, sizeBytes: 11 * 1024 * 1024 }).success).toBe(false);
  });

  it("revokes sessions after a security-sensitive role change", async () => {
    const session = await db.session.create({ data: { tokenHash: randomUUID().replaceAll("-", "").padEnd(64, "0"), adminId, twoFactorAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
    await updateAdminSafely(adminId, { role: "EDITOR" });
    expect(await db.session.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({ revokeReason: "SECURITY_CHANGE" });
    await updateAdminSafely(adminId, { role: "SUPER_ADMIN" });
  });

  it("persists success audit events for every tested domain", async () => {
    const entries = await db.auditLog.findMany({ where: { requestId: { startsWith: prefix }, result: "SUCCESS" }, select: { action: true, targetType: true } });
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "COMPANY_UPDATED", targetType: "Company" }),
      expect.objectContaining({ action: "CONTENT_CREATED", targetType: "Service" }),
      expect.objectContaining({ action: "CONTENT_PUBLISHED", targetType: "Service" }),
      expect.objectContaining({ action: "CONTENT_TRASHED", targetType: "Service" }),
      expect.objectContaining({ action: "CONTENT_RESTORED", targetType: "Service" }),
      expect.objectContaining({ action: "CONTENT_DELETED_PERMANENTLY", targetType: "Service" }),
      expect.objectContaining({ action: "TAXONOMY_CREATED", targetType: "Brand" }),
    ]));
  });
});
