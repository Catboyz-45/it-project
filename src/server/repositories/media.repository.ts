import { type MediaKind, type Prisma } from "@prisma/client";
import { db } from "@/server/db/client";

export class MediaRepository {
  createPending(data: {
    kind: MediaKind;
    objectKey: string;
    originalName?: string;
    mimeType: string;
    sizeBytes: bigint;
    checksumSha256?: string;
    width?: number;
    height?: number;
    altText?: string;
    isPrivate?: boolean;
    uploadedById?: string;
  }) {
    return db.media.create({ data });
  }

  findAvailableById(id: string) {
    return db.media.findFirst({ where: { id, deletedAt: null } });
  }

  markDeleted(id: string, now = new Date()) {
    const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return db.media.update({ where: { id }, data: { deletedAt: now, purgeAt } });
  }

  findPurgeCandidates(now = new Date(), take = 100) {
    return db.media.findMany({
      where: { deletedAt: { not: null }, purgeAt: { lte: now } },
      orderBy: { purgeAt: "asc" },
      take,
      select: { id: true, objectKey: true, kind: true },
    });
  }

  deleteMetadata(id: string, transaction: Prisma.TransactionClient = db) {
    return transaction.media.delete({ where: { id } });
  }
}
