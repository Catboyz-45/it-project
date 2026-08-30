/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ media-lifecycle.e2e.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { CreateBucketCommand, DeleteObjectsCommand, HeadBucketCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import argon2 from "argon2";
import * as OTPAuth from "otpauth";

const run = promisify(execFile);
const enabled = process.env.RUN_MEDIA_E2E === "1";
const origin = process.env.APP_URL ?? "http://127.0.0.1:3000";

function storageClient() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("Media E2E storage environment is incomplete");
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? "auto",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 3,
  });
}

async function ensureTestBucket(client: S3Client, bucket: string) {
  if (!bucket.includes("e2e") && !bucket.includes("test")) throw new Error("Refusing to use a non-test media bucket");
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

test.describe("media lifecycle", () => {
  test.skip(!enabled, "Set RUN_MEDIA_E2E=1 with an isolated PostgreSQL database and S3-compatible test bucket");
  test.describe.configure({ mode: "serial" });

  test("uploads, processes, authorizes, references, trashes, and purges image and PDF objects", async ({ request, playwright }) => {
    test.setTimeout(120_000);
    const database = new PrismaClient();
    const client = storageClient();
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is required for media E2E");
    await ensureTestBucket(client, bucket);

    const suffix = randomUUID().slice(0, 8);
    const username = `media-e2e-${suffix}`;
    const temporaryPassword = `Media-E2e-Temporary-${suffix}!`;
    const permanentPassword = `Media-E2e-Permanent-${suffix}!`;
    const headers = { Origin: origin };
    const mediaIds: string[] = [];
    const contentIds: string[] = [];
    const taxonomyIds: string[] = [];

    try {
      await database.admin.create({
        data: {
          username,
          usernameNormalized: username,
          displayName: "Media E2E Admin",
          role: "SUPER_ADMIN",
          passwordHash: await argon2.hash(temporaryPassword, { type: argon2.argon2id }),
          mustChangePassword: true,
        },
      });

      const login = await request.post("/api/auth/login", { headers, data: { username, password: temporaryPassword } });
      expect(login.status()).toBe(200);
      expect((await login.json()).next).toBe("/change-password");
      const changed = await request.post("/api/auth/password", { headers, data: { password: permanentPassword, confirm: permanentPassword } });
      expect(changed.status()).toBe(200);

      const setup = await request.get("/api/auth/2fa/setup");
      expect(setup.status()).toBe(200);
      const { secret } = (await setup.json()) as { secret: string };
      const code = new OTPAuth.TOTP({
        issuer: "อยู่เย็นเป็นสุข วิศวกรรม",
        label: username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      }).generate();
      expect((await request.post("/api/auth/2fa/setup/verify", { headers, data: { code } })).status()).toBe(200);

      const image = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAJ0lEQVQ4jWNQKHChKWIYtaBgNIhcRlORwmhGcxktKhRGS9MC2lY4ALoY3RAnTlWmAAAAAElFTkSuQmCC",
        "base64",
      );
      const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

      const upload = async (filename: string, mimeType: string, body: Buffer, altText?: string) => {
        const started = await request.post("/api/admin/media/uploads", {
          headers,
          data: { filename, mimeType, sizeBytes: body.byteLength, ...(altText ? { altText } : {}) },
        });
        expect(started.status()).toBe(201);
        const pending = (await started.json()) as { mediaId: string; uploadUrl: string };
        mediaIds.push(pending.mediaId);
        const stored = await request.put(pending.uploadUrl, {
          headers: { "Content-Type": mimeType, "Content-Length": String(body.byteLength) },
          data: body,
        });
        expect(stored.ok()).toBeTruthy();
        const completed = await request.post(`/api/admin/media/uploads/${pending.mediaId}/complete`, { headers, data: {} });
        expect(completed.status()).toBe(200);
        return pending.mediaId;
      };

      const imageId = await upload("e2e-cover.png", "image/png", image, "ภาพทดสอบวงจรไฟล์");
      const pdfId = await upload("e2e-catalog.pdf", "application/pdf", pdf);

      const library = await request.get("/api/admin/media?pageSize=10");
      expect(library.status()).toBe(200);
      const media = (await library.json()) as { items: Array<{ id: string; kind: string; altText: string | null; variants: Array<{ format: string }> }> };
      const processedImage = media.items.find(item => item.id === imageId);
      expect(processedImage).toMatchObject({ kind: "IMAGE", altText: "ภาพทดสอบวงจรไฟล์" });
      expect(new Set(processedImage?.variants.map(item => item.format))).toEqual(new Set(["WEBP", "AVIF"]));
      expect(media.items.find(item => item.id === pdfId)?.kind).toBe("PDF");

      const anonymous = await playwright.request.newContext({ baseURL: origin });
      try {
        expect((await anonymous.get(`/api/media/${imageId}`, { maxRedirects: 0 })).status()).toBe(404);

        const brand = await request.post("/api/admin/taxonomies/brands", { headers, data: { name: `E2E Brand ${suffix}`, slug: `e2e-brand-${suffix}`, sortOrder: 0, isActive: true } });
        expect(brand.status()).toBe(201);
        const brandId = ((await brand.json()) as { item: { id: string } }).item.id;
        taxonomyIds.push(brandId);
        const type = await request.post("/api/admin/taxonomies/product-types", { headers, data: { name: `E2E Type ${suffix}`, slug: `e2e-type-${suffix}`, sortOrder: 0, isActive: true } });
        expect(type.status()).toBe(201);
        const productTypeId = ((await type.json()) as { item: { id: string } }).item.id;
        taxonomyIds.push(productTypeId);

        const productPayload = {
          slug: `media-e2e-${suffix}`, name: `Media E2E ${suffix}`, model: `MODEL-${suffix}`, summary: "ทดสอบวงจรไฟล์แบบครบถ้วน",
          content: null, btuMin: null, btuMax: null, features: null, specifications: null, warranty: null, seer: null, refrigerant: null,
          priceLabel: "สอบถามราคา", isFeatured: false, isSearchable: true, seoTitle: null, seoDescription: null,
          brandId, productTypeId, coverMediaId: imageId, catalogMediaId: pdfId, galleryMediaIds: [imageId], status: "PUBLISHED",
        };
        const product = await request.post("/api/admin/content/products", { headers, data: productPayload });
        expect(product.status()).toBe(201);
        const productId = ((await product.json()) as { record: { id: string } }).record.id;
        contentIds.push(productId);

        const imageRedirect = await anonymous.get(`/api/media/${imageId}?width=640&format=webp`, { maxRedirects: 0 });
        expect(imageRedirect.status()).toBe(302);
        expect(imageRedirect.headers()["x-robots-tag"]).toContain("noindex");
        const renderedImage = await anonymous.get(imageRedirect.headers().location);
        expect(renderedImage.status()).toBe(200);
        expect(renderedImage.headers()["content-type"]).toContain("image/webp");

        const catalogRedirect = await anonymous.get(`/api/catalogs/${productPayload.slug}`, { maxRedirects: 0 });
        expect(catalogRedirect.status()).toBe(302);
        const downloadedPdf = await anonymous.get(catalogRedirect.headers().location);
        expect(downloadedPdf.status()).toBe(200);
        expect(downloadedPdf.headers()["content-type"]).toContain("application/pdf");
        expect((await downloadedPdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

        expect((await request.delete(`/api/admin/media/${imageId}`, { headers, data: {} })).status()).toBe(409);
        expect((await request.delete(`/api/admin/media/${pdfId}`, { headers, data: {} })).status()).toBe(409);

        const detached = { ...productPayload, coverMediaId: null, catalogMediaId: null, galleryMediaIds: [] };
        expect((await request.patch(`/api/admin/content/products/${productId}`, { headers, data: detached })).status()).toBe(200);
        expect((await anonymous.get(`/api/media/${imageId}`, { maxRedirects: 0 })).status()).toBe(404);
        expect((await anonymous.get(`/api/catalogs/${productPayload.slug}`, { maxRedirects: 0 })).status()).toBe(404);

        expect((await request.delete(`/api/admin/media/${imageId}`, { headers, data: {} })).status()).toBe(204);
        expect((await request.delete(`/api/admin/media/${pdfId}`, { headers, data: {} })).status()).toBe(204);
      } finally {
        await anonymous.dispose();
      }

      const storedKeys = (await database.media.findMany({ where: { id: { in: mediaIds } }, include: { variants: true } }))
        .flatMap(item => [item.objectKey, ...item.variants.map(variant => variant.objectKey)]);
      await database.media.updateMany({
        where: { id: { in: mediaIds } },
        data: { deletedAt: new Date(Date.now() - 120_000), purgeAt: new Date(Date.now() - 60_000) },
      });
      await run("npm", ["run", "media:cleanup"], { cwd: process.cwd(), env: process.env });
      expect(await database.media.count({ where: { id: { in: mediaIds } } })).toBe(0);
      expect(await database.storageCleanupJob.count({ where: { mediaId: { in: mediaIds }, completedAt: null } })).toBeGreaterThan(0);
      await run("npm", ["run", "media:cleanup"], { cwd: process.cwd(), env: process.env });
      expect(await database.storageCleanupJob.count({ where: { mediaId: { in: mediaIds }, completedAt: null } })).toBe(0);
      for (const objectKey of storedKeys) {
        await expect(client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }))).rejects.toMatchObject({ name: "NotFound" });
      }
    } finally {
      await database.product.deleteMany({ where: { id: { in: contentIds } } }).catch(() => undefined);
      await database.brand.deleteMany({ where: { id: { in: taxonomyIds } } }).catch(() => undefined);
      await database.productType.deleteMany({ where: { id: { in: taxonomyIds } } }).catch(() => undefined);
      const remainingMedia = await database.media.findMany({ where: { id: { in: mediaIds } }, include: { variants: true } }).catch(() => []);
      const remainingKeys = remainingMedia.flatMap(item => [item.objectKey, ...item.variants.map(variant => variant.objectKey)]);
      await database.storageCleanupJob.deleteMany({ where: { mediaId: { in: mediaIds } } }).catch(() => undefined);
      await database.media.deleteMany({ where: { id: { in: mediaIds } } }).catch(() => undefined);
      if (remainingKeys.length) {
        await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: remainingKeys.map(Key => ({ Key })) } })).catch(() => undefined);
      }
      await database.admin.deleteMany({ where: { usernameNormalized: username } }).catch(() => undefined);
      await database.$disconnect();
      client.destroy();
    }
  });
});
