import { db } from "@/server/db/client";

export class RedirectRepository {
  findActive(fromPath: string) {
    return db.redirect.findFirst({ where: { fromPath, isActive: true } });
  }

  upsertPermanent(fromPath: string, toPath: string) {
    return db.redirect.upsert({
      where: { fromPath },
      create: { fromPath, toPath, statusCode: 301, isActive: true },
      update: { toPath, statusCode: 301, isActive: true },
    });
  }

  recordHit(id: string) {
    return db.redirect.update({ where: { id }, data: { hitCount: { increment: 1 }, lastHitAt: new Date() } });
  }
}
