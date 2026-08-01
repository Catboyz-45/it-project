import { createHash, randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { storage } from "@/server/storage/s3";
import { optimizeImage } from "./images";
import { matchesSignature, safeFilename } from "./validation";

const UPLOAD_TTL_MS = 15 * 60_000;
const key = (scope: string, suffix: string) => `media/${scope}/${randomUUID()}${suffix}`;

export async function createUpload(input: { filename: string; mimeType: string; sizeBytes: number; altText?: string }, adminId: string) {
  const image = input.mimeType.startsWith("image/");
  const objectKey = key("incoming", ".upload");
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
  const media = await db.media.create({ data: { kind: image ? "IMAGE" : "PDF", objectKey, originalName: safeFilename(input.filename), mimeType: input.mimeType, sizeBytes: BigInt(input.sizeBytes), altText: input.altText, isPrivate: true, status: "UPLOADING", uploadExpiresAt: expiresAt, uploadedById: adminId } });
  try {
    const uploadUrl = await storage().signPut(objectKey, input.mimeType, input.sizeBytes, Math.floor(UPLOAD_TTL_MS / 1000));
    return { mediaId: media.id, uploadUrl, expiresAt };
  } catch (error) {
    await db.media.delete({ where: { id: media.id } }).catch(() => undefined);
    throw error;
  }
}

export async function completeUpload(mediaId: string, adminId: string) {
  const claimed = await db.media.updateMany({ where: { id: mediaId, uploadedById: adminId, status: "UPLOADING", uploadExpiresAt: { gt: new Date() }, deletedAt: null }, data: { status: "PROCESSING" } });
  if (claimed.count !== 1) throw new Error("UPLOAD_NOT_AVAILABLE");
  const media = await db.media.findUniqueOrThrow({ where: { id: mediaId } });
  const createdKeys: string[] = [];
  try {
    const object = storage();
    const head = await object.head(media.objectKey);
    const max = media.kind === "IMAGE" ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    if (head.size <= 0 || head.size > max || head.size !== Number(media.sizeBytes) || head.contentType !== media.mimeType) throw new Error("INVALID_UPLOAD_METADATA");
    const original = await object.get(media.objectKey);
    if (original.byteLength !== head.size || !matchesSignature(original, media.mimeType)) throw new Error("INVALID_FILE_SIGNATURE");
    const checksumSha256 = createHash("sha256").update(original).digest("hex");

    if (media.kind === "PDF") {
      const finalKey = key("pdf", ".pdf");
      await object.put(finalKey, original, "application/pdf"); createdKeys.push(finalKey);
      await db.$transaction([
        db.media.update({ where: { id: media.id }, data: { objectKey: finalKey, sizeBytes: BigInt(original.byteLength), checksumSha256, status: "READY", uploadExpiresAt: null, failureReason: null } }),
        db.storageCleanupJob.create({ data: { mediaId: media.id, objectKeys: [media.objectKey] } }),
      ]);
      return media.id;
    }

    const optimized = await optimizeImage(original);
    const rows = [];
    for (const variant of optimized.variants) {
      const variantKey = key("images", `-${variant.width}.${variant.format.toLowerCase()}`);
      await object.put(variantKey, variant.data, variant.mimeType); createdKeys.push(variantKey);
      rows.push({ mediaId: media.id, format: variant.format, width: variant.width, height: variant.height, objectKey: variantKey, mimeType: variant.mimeType, sizeBytes: BigInt(variant.data.byteLength) });
    }
    const primary = rows.filter(row => row.format === "WEBP").sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
    await db.$transaction([
      db.mediaVariant.createMany({ data: rows }),
      db.media.update({ where: { id: media.id }, data: { objectKey: primary.objectKey, mimeType: primary.mimeType, sizeBytes: primary.sizeBytes, checksumSha256, width: optimized.width, height: optimized.height, status: "READY", uploadExpiresAt: null, failureReason: null } }),
      db.storageCleanupJob.create({ data: { mediaId: media.id, objectKeys: [media.objectKey] } }),
    ]);
    return media.id;
  } catch (error) {
    if (createdKeys.length) await db.storageCleanupJob.create({ data: { mediaId, objectKeys: createdKeys } }).catch(() => undefined);
    await db.media.update({ where: { id: mediaId }, data: { status: "FAILED", failureReason: error instanceof Error ? error.message.slice(0, 200) : "PROCESSING_FAILED" } }).catch(() => undefined);
    throw error;
  }
}

export async function referenceCount(mediaId: string) {
  const [company, banners, services, productCovers, productCatalogs, productGallery, projectCovers, projectGallery, news] = await db.$transaction([
    db.company.count({ where: { logoMediaId: mediaId } }), db.banner.count({ where: { imageId: mediaId } }), db.service.count({ where: { coverMediaId: mediaId } }),
    db.product.count({ where: { coverMediaId: mediaId } }), db.product.count({ where: { catalogMediaId: mediaId } }), db.productMedia.count({ where: { mediaId } }),
    db.project.count({ where: { coverMediaId: mediaId } }), db.projectMedia.count({ where: { mediaId } }), db.news.count({ where: { coverMediaId: mediaId } }),
  ]);
  return company + banners + services + productCovers + productCatalogs + productGallery + projectCovers + projectGallery + news;
}

export async function trashMedia(mediaId: string) {
  if (await referenceCount(mediaId)) throw new Error("MEDIA_IN_USE");
  const now = new Date();
  return db.media.update({ where: { id: mediaId, deletedAt: null }, data: { deletedAt: now, purgeAt: new Date(now.getTime() + 30 * 86_400_000) } });
}
