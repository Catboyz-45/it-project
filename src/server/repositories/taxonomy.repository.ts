import { db } from "@/server/db/client";

export class TaxonomyRepository {
  listActiveBrands() {
    return db.brand.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }

  listActiveProductTypes() {
    return db.productType.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }

  listActiveNewsCategories() {
    return db.newsCategory.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }
}
