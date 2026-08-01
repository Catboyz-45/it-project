import "dotenv/config";
import { db } from "../src/server/db";

async function main() {
  const now = new Date(); let purged = 0;
  await db.$transaction(async tx => {
    const [banners, products, projects, news] = await Promise.all([
      tx.banner.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } } }),
      tx.product.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } } }),
      tx.project.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } } }),
      tx.news.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now } } }),
    ]);
    purged += banners.count + products.count + projects.count + news.count;
    const services = await tx.service.findMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now }, projects: { none: {} } }, select: { id: true } });
    if (services.length) { await tx.service.deleteMany({ where: { id: { in: services.map(item => item.id) } } }); purged += services.length; }
    const brands = await tx.brand.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now }, products: { none: {} } } });
    const types = await tx.productType.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now }, products: { none: {} } } });
    const categories = await tx.newsCategory.deleteMany({ where: { deletedAt: { not: null }, purgeAt: { lte: now }, news: { none: {} } } });
    purged += brands.count + types.count + categories.count;
    await tx.auditLog.create({ data: { action: "RETENTION_PURGE_COMPLETED", targetType: "System", result: "SUCCESS", metadata: { purged } } });
  });
  process.stdout.write(`Purged ${purged} expired records.\n`);
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Cleanup failed"}\n`); process.exitCode = 1; }).finally(() => db.$disconnect());
