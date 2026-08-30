/**
 * หน้าที่ของไฟล์นี้: ชั้น repository taxonomy.repository เป็นจุดอ่านและเขียนฐานข้อมูลของโดเมนนี้ เพื่อไม่ให้ UI ติดต่อฐานข้อมูลโดยตรง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
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
