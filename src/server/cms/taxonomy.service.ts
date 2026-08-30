/**
 * หน้าที่ของไฟล์นี้: ชั้น service taxonomy.service รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { Prisma, type AdminRole } from "@prisma/client";
import { db } from "@/server/db";
import { CmsError } from "./errors";
import { taxonomySchema, type TaxonomyKind } from "./schemas";

type Actor = { id: string; role: AdminRole };
type Context = { requestId?: string; ipHash?: string; userAgent?: string | null };
const labels: Record<TaxonomyKind, string> = { brands: "Brand", "product-types": "ProductType", "news-categories": "NewsCategory" };
function audit(actor: Actor, kind: TaxonomyKind, id: string, action: string, context: Context): Prisma.AuditLogCreateInput { return { actor: { connect: { id: actor.id } }, action, targetType: labels[kind], targetId: id, result: "SUCCESS", requestId: context.requestId, userAgent: context.userAgent, metadata: context.ipHash ? { ipHash: context.ipHash } : undefined }; }

export class TaxonomyService {
  list(kind: TaxonomyKind) {
    if (kind === "brands") return db.brand.findMany({ where: { deletedAt: null }, include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    if (kind === "product-types") return db.productType.findMany({ where: { deletedAt: null }, include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    return db.newsCategory.findMany({ where: { deletedAt: null }, include: { _count: { select: { news: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }
  create(kind: TaxonomyKind, input: unknown, actor: Actor, context: Context) { const data = taxonomySchema.parse(input); return db.$transaction(async tx => { const record = kind === "brands" ? await tx.brand.create({ data }) : kind === "product-types" ? await tx.productType.create({ data }) : await tx.newsCategory.create({ data }); await tx.auditLog.create({ data: audit(actor, kind, record.id, "TAXONOMY_CREATED", context) }); return record; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  update(kind: TaxonomyKind, id: string, input: unknown, actor: Actor, context: Context) { const data = taxonomySchema.parse(input); return db.$transaction(async tx => { const record = kind === "brands" ? await tx.brand.update({ where: { id }, data }) : kind === "product-types" ? await tx.productType.update({ where: { id }, data }) : await tx.newsCategory.update({ where: { id }, data }); await tx.auditLog.create({ data: audit(actor, kind, id, "TAXONOMY_UPDATED", context) }); return record; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  remove(kind: TaxonomyKind, id: string, actor: Actor, context: Context) { return db.$transaction(async tx => { const count = kind === "brands" ? await tx.product.count({ where: { brandId: id } }) : kind === "product-types" ? await tx.product.count({ where: { productTypeId: id } }) : await tx.news.count({ where: { categoryId: id } }); if (count) throw new CmsError("IN_USE", "รายการนี้ยังถูกใช้งานอยู่"); const now = new Date(); const data = { deletedAt: now, purgeAt: new Date(now.getTime() + 30 * 86_400_000), isActive: false }; if (kind === "brands") await tx.brand.update({ where: { id }, data }); else if (kind === "product-types") await tx.productType.update({ where: { id }, data }); else await tx.newsCategory.update({ where: { id }, data }); await tx.auditLog.create({ data: audit(actor, kind, id, "TAXONOMY_TRASHED", context) }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  transition(kind: TaxonomyKind, id: string, action: "restore" | "delete", actor: Actor, context: Context) { if (action === "delete" && actor.role !== "SUPER_ADMIN") throw new CmsError("FORBIDDEN", "เฉพาะ Super Admin เท่านั้น"); return db.$transaction(async tx => { const count = kind === "brands" ? await tx.product.count({ where: { brandId: id } }) : kind === "product-types" ? await tx.product.count({ where: { productTypeId: id } }) : await tx.news.count({ where: { categoryId: id } }); if (count) throw new CmsError("IN_USE", "รายการนี้ยังถูกใช้งานอยู่"); if (action === "restore") { const data = { deletedAt: null, purgeAt: null, isActive: true }; if (kind === "brands") await tx.brand.update({ where: { id }, data }); else if (kind === "product-types") await tx.productType.update({ where: { id }, data }); else await tx.newsCategory.update({ where: { id }, data }); } else if (kind === "brands") await tx.brand.delete({ where: { id } }); else if (kind === "product-types") await tx.productType.delete({ where: { id } }); else await tx.newsCategory.delete({ where: { id } }); await tx.auditLog.create({ data: audit(actor, kind, id, action === "restore" ? "TAXONOMY_RESTORED" : "TAXONOMY_DELETED_PERMANENTLY", context) }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
}
