import "dotenv/config";
import { db } from "../src/server/db/client";
import { referenceCount } from "../src/server/media/service";
import { storage } from "../src/server/storage/s3";

const now = new Date();
const candidates = await db.media.findMany({ where: { OR: [{ status: { in: ["UPLOADING", "PROCESSING", "FAILED"] }, uploadExpiresAt: { lte: now } }, { deletedAt: { not: null }, purgeAt: { lte: now } }] }, take: 100, include: { variants: { select: { objectKey: true } } } });
for (const media of candidates) {
  if (await referenceCount(media.id)) continue;
  const objectKeys = [...new Set([media.objectKey, ...media.variants.map(item => item.objectKey)])];
  await db.$transaction([db.storageCleanupJob.create({ data: { mediaId: media.id, objectKeys } }), db.media.delete({ where: { id: media.id } })]);
}

const jobs = await db.storageCleanupJob.findMany({ where: { completedAt: null, nextRunAt: { lte: now } }, orderBy: { createdAt: "asc" }, take: 100 });
for (const job of jobs) {
  const keys = Array.isArray(job.objectKeys) ? job.objectKeys.filter((value): value is string => typeof value === "string") : [];
  try {
    await storage().deleteMany(keys);
    await db.storageCleanupJob.update({ where: { id: job.id }, data: { completedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
  } catch (error) {
    const attempts = job.attempts + 1; const delayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
    await db.storageCleanupJob.update({ where: { id: job.id }, data: { attempts, lastError: error instanceof Error ? error.message.slice(0, 500) : "STORAGE_DELETE_FAILED", nextRunAt: new Date(Date.now() + delayMinutes * 60_000) } });
  }
}
await db.$disconnect();
