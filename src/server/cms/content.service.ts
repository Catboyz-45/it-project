import "server-only";
import { ContentStatus, Prisma, type AdminRole } from "@prisma/client";
import { db } from "@/server/db";
import { CmsError } from "./errors";
import { bannerSchema, listQuerySchema, newsSchema, productSchema, projectSchema, serviceSchema, type ContentKind } from "./schemas";
import { canTransition, retentionDate } from "./rules";

type Actor = { id: string; role: AdminRole };
type AuditContext = { requestId?: string; ipHash?: string; userAgent?: string | null };
const paths: Partial<Record<ContentKind, string>> = { services: "/services", products: "/products", projects: "/projects", news: "/news" };
const labels: Record<ContentKind, string> = { banners: "Banner", services: "Service", products: "Product", projects: "Project", news: "News" };

function publishedAt(status: "DRAFT" | "PUBLISHED", requested?: Date | null) { return status === "PUBLISHED" ? requested ?? new Date() : null; }
function auditData(actor: Actor, action: string, kind: ContentKind, targetId: string, context: AuditContext, metadata?: Prisma.InputJsonObject): Prisma.AuditLogCreateInput {
  return { actor: { connect: { id: actor.id } }, action, targetType: labels[kind], targetId, result: "SUCCESS", requestId: context.requestId, userAgent: context.userAgent, metadata: { ...(metadata ?? {}), ...(context.ipHash ? { ipHash: context.ipHash } : {}) } };
}
function orderBy(sort: string, titleField: "title" | "name" = "title") {
  if (sort === "updated-asc") return [{ updatedAt: "asc" as const }];
  if (sort === "title-asc") return [{ [titleField]: "asc" as const }];
  if (sort === "title-desc") return [{ [titleField]: "desc" as const }];
  return [{ updatedAt: "desc" as const }];
}
async function assertMedia(tx: Prisma.TransactionClient, images: Array<string | null | undefined>, pdfs: Array<string | null | undefined> = []) {
  const imageIds = [...new Set(images.filter((id): id is string => Boolean(id)))]; const pdfIds = [...new Set(pdfs.filter((id): id is string => Boolean(id)))];
  const [imageCount, pdfCount] = await Promise.all([tx.media.count({ where: { id: { in: imageIds }, kind: "IMAGE", status: "READY", deletedAt: null } }), tx.media.count({ where: { id: { in: pdfIds }, kind: "PDF", status: "READY", deletedAt: null } })]);
  if (imageCount !== imageIds.length || pdfCount !== pdfIds.length) throw new CmsError("INVALID_MEDIA", "ไฟล์สื่อไม่พร้อมใช้งานหรือชนิดไฟล์ไม่ถูกต้อง");
}

export class ContentService {
  async list(kind: ContentKind, rawQuery: unknown) {
    const query = listQuerySchema.parse(rawQuery); const skip = (query.page - 1) * query.pageSize;
    const base = { deletedAt: null, ...(query.status === "ALL" ? {} : { status: query.status as ContentStatus }) };
    let items: Array<{ id: string; slug?: string; title: string; status: ContentStatus; updatedAt: Date }> = []; let total = 0;
    if (kind === "banners") {
      const where: Prisma.BannerWhereInput = { ...base, ...(query.query ? { title: { contains: query.query, mode: "insensitive" } } : {}) };
      [items, total] = await db.$transaction([db.banner.findMany({ where, select: { id: true, title: true, status: true, updatedAt: true }, skip, take: query.pageSize, orderBy: orderBy(query.sort) }), db.banner.count({ where })]);
    } else if (kind === "services") {
      const where: Prisma.ServiceWhereInput = { ...base, ...(query.query ? { OR: [{ title: { contains: query.query, mode: "insensitive" } }, { summary: { contains: query.query, mode: "insensitive" } }] } : {}) };
      [items, total] = await db.$transaction([db.service.findMany({ where, select: { id: true, slug: true, title: true, status: true, updatedAt: true }, skip, take: query.pageSize, orderBy: orderBy(query.sort) }), db.service.count({ where })]);
    } else if (kind === "products") {
      const where: Prisma.ProductWhereInput = { ...base, ...(query.query ? { OR: [{ name: { contains: query.query, mode: "insensitive" } }, { model: { contains: query.query, mode: "insensitive" } }] } : {}) };
      const result = await db.$transaction([db.product.findMany({ where, select: { id: true, slug: true, name: true, model: true, status: true, updatedAt: true }, skip, take: query.pageSize, orderBy: orderBy(query.sort, "name") }), db.product.count({ where })]);
      items = result[0].map(item => ({ ...item, title: item.name })); total = result[1];
    } else if (kind === "projects") {
      const where: Prisma.ProjectWhereInput = { ...base, ...(query.query ? { OR: [{ title: { contains: query.query, mode: "insensitive" } }, { area: { contains: query.query, mode: "insensitive" } }] } : {}) };
      [items, total] = await db.$transaction([db.project.findMany({ where, select: { id: true, slug: true, title: true, status: true, updatedAt: true }, skip, take: query.pageSize, orderBy: orderBy(query.sort) }), db.project.count({ where })]);
    } else {
      const where: Prisma.NewsWhereInput = { ...base, ...(query.query ? { OR: [{ title: { contains: query.query, mode: "insensitive" } }, { summary: { contains: query.query, mode: "insensitive" } }] } : {}) };
      [items, total] = await db.$transaction([db.news.findMany({ where, select: { id: true, slug: true, title: true, status: true, updatedAt: true }, skip, take: query.pageSize, orderBy: orderBy(query.sort) }), db.news.count({ where })]);
    }
    return { items, total, page: query.page, pageSize: query.pageSize, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) };
  }

  async get(kind: ContentKind, idOrSlug: string, includeDeleted = false) {
    const where = { OR: [{ id: idOrSlug }, ...kind === "banners" ? [] : [{ slug: idOrSlug }]], ...(!includeDeleted ? { deletedAt: null } : {}) };
    if (kind === "banners") return db.banner.findFirst({ where: { id: idOrSlug, ...(!includeDeleted ? { deletedAt: null } : {}) }, include: { image: true } });
    if (kind === "services") return db.service.findFirst({ where, include: { coverMedia: true } });
    if (kind === "products") return db.product.findFirst({ where, include: { coverMedia: true, catalogMedia: true, gallery: { orderBy: { sortOrder: "asc" }, include: { media: true } }, brand: true, productType: true } });
    if (kind === "projects") return db.project.findFirst({ where, include: { coverMedia: true, gallery: { orderBy: { sortOrder: "asc" }, include: { media: true } }, services: true } });
    return db.news.findFirst({ where, include: { coverMedia: true, category: true } });
  }

  async create(kind: ContentKind, input: unknown, actor: Actor, context: AuditContext) {
    return db.$transaction(async tx => {
      let record: { id: string };
      if (kind === "banners") { const data = bannerSchema.parse(input); await assertMedia(tx, [data.imageId]); record = await tx.banner.create({ data: { ...data, publishedAt: publishedAt(data.status) } }); }
      else if (kind === "services") { const data = serviceSchema.parse(input); await assertMedia(tx, [data.coverMediaId]); record = await tx.service.create({ data: { ...data, publishedAt: publishedAt(data.status) } }); }
      else if (kind === "products") { const data = productSchema.parse(input); await assertMedia(tx, [data.coverMediaId, ...data.galleryMediaIds], [data.catalogMediaId]); const { galleryMediaIds, specifications, ...values } = data; record = await tx.product.create({ data: { ...values, specifications: specifications ?? Prisma.JsonNull, publishedAt: publishedAt(data.status), gallery: { create: galleryMediaIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder })) } } }); }
      else if (kind === "projects") { const data = projectSchema.parse(input); await assertMedia(tx, [data.coverMediaId, ...data.galleryMediaIds]); const { galleryMediaIds, serviceIds, ...values } = data; record = await tx.project.create({ data: { ...values, publishedAt: publishedAt(data.status), gallery: { create: galleryMediaIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder })) }, services: { create: serviceIds.map(serviceId => ({ serviceId })) } } }); }
      else { const data = newsSchema.parse(input); await assertMedia(tx, [data.coverMediaId]); record = await tx.news.create({ data: { ...data, publishedAt: publishedAt(data.status, data.publishedAt) } }); }
      await tx.auditLog.create({ data: auditData(actor, "CONTENT_CREATED", kind, record.id, context) }); return record;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async update(kind: ContentKind, id: string, input: unknown, actor: Actor, context: AuditContext, expectedUpdatedAt?: string | null) {
    return db.$transaction(async tx => {
      const current = await this.findForUpdate(tx, kind, id); if (!current || current.deletedAt) throw new CmsError("NOT_FOUND", "ไม่พบรายการ");
      if (expectedUpdatedAt && current.updatedAt.toISOString() !== expectedUpdatedAt) throw new CmsError("CONFLICT", "ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก");
      let record: { id: string }; let nextSlug: string | undefined; let desiredStatus: ContentStatus;
      if (kind === "banners") { const data = bannerSchema.parse(input); await assertMedia(tx, [data.imageId]); desiredStatus = data.status; if (!canTransition(current.status, desiredStatus)) throw new CmsError("INVALID_TRANSITION", "ต้องกู้รายการเก็บถาวรเป็นฉบับร่างก่อนเผยแพร่"); record = await tx.banner.update({ where: { id }, data: { ...data, publishedAt: publishedAt(data.status, current.publishedAt) } }); }
      else if (kind === "services") { const data = serviceSchema.parse(input); await assertMedia(tx, [data.coverMediaId]); desiredStatus = data.status; if (!canTransition(current.status, desiredStatus)) throw new CmsError("INVALID_TRANSITION", "ต้องกู้รายการเก็บถาวรเป็นฉบับร่างก่อนเผยแพร่"); nextSlug = data.slug; record = await tx.service.update({ where: { id }, data: { ...data, publishedAt: publishedAt(data.status, current.publishedAt) } }); }
      else if (kind === "products") { const data = productSchema.parse(input); await assertMedia(tx, [data.coverMediaId, ...data.galleryMediaIds], [data.catalogMediaId]); desiredStatus = data.status; if (!canTransition(current.status, desiredStatus)) throw new CmsError("INVALID_TRANSITION", "ต้องกู้รายการเก็บถาวรเป็นฉบับร่างก่อนเผยแพร่"); nextSlug = data.slug; const { galleryMediaIds, specifications, ...values } = data; await tx.productMedia.deleteMany({ where: { productId: id } }); record = await tx.product.update({ where: { id }, data: { ...values, specifications: specifications ?? Prisma.JsonNull, publishedAt: publishedAt(data.status, current.publishedAt), gallery: { create: galleryMediaIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder })) } } }); }
      else if (kind === "projects") { const data = projectSchema.parse(input); await assertMedia(tx, [data.coverMediaId, ...data.galleryMediaIds]); desiredStatus = data.status; if (!canTransition(current.status, desiredStatus)) throw new CmsError("INVALID_TRANSITION", "ต้องกู้รายการเก็บถาวรเป็นฉบับร่างก่อนเผยแพร่"); nextSlug = data.slug; const { galleryMediaIds, serviceIds, ...values } = data; await tx.projectMedia.deleteMany({ where: { projectId: id } }); await tx.projectService.deleteMany({ where: { projectId: id } }); record = await tx.project.update({ where: { id }, data: { ...values, publishedAt: publishedAt(data.status, current.publishedAt), gallery: { create: galleryMediaIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder })) }, services: { create: serviceIds.map(serviceId => ({ serviceId })) } } }); }
      else { const data = newsSchema.parse(input); await assertMedia(tx, [data.coverMediaId]); desiredStatus = data.status; if (!canTransition(current.status, desiredStatus)) throw new CmsError("INVALID_TRANSITION", "ต้องกู้รายการเก็บถาวรเป็นฉบับร่างก่อนเผยแพร่"); nextSlug = data.slug; record = await tx.news.update({ where: { id }, data: { ...data, publishedAt: publishedAt(data.status, data.publishedAt ?? current.publishedAt) } }); }
      if (current.slug && nextSlug && current.slug !== nextSlug && current.status === ContentStatus.PUBLISHED) {
        const prefix = paths[kind]; if (prefix) await tx.redirect.upsert({ where: { fromPath: `${prefix}/${current.slug}` }, create: { fromPath: `${prefix}/${current.slug}`, toPath: `${prefix}/${nextSlug}`, statusCode: 301 }, update: { toPath: `${prefix}/${nextSlug}`, statusCode: 301, isActive: true } });
      }
      await tx.auditLog.create({ data: auditData(actor, current.status === desiredStatus ? "CONTENT_UPDATED" : `CONTENT_${desiredStatus}`, kind, id, context, { slugChanged: Boolean(current.slug && nextSlug && current.slug !== nextSlug), previousStatus: current.status }) }); return record;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async transition(kind: ContentKind, id: string, action: "publish" | "unpublish" | "archive" | "trash" | "restore" | "delete", actor: Actor, context: AuditContext) {
    if (action === "delete" && actor.role !== "SUPER_ADMIN") throw new CmsError("FORBIDDEN", "เฉพาะ Super Admin เท่านั้น");
    return db.$transaction(async tx => {
      const current = await this.findForUpdate(tx, kind, id); if (!current) throw new CmsError("NOT_FOUND", "ไม่พบรายการ");
      if (action === "delete") { if (!current.deletedAt) throw new CmsError("INVALID_TRANSITION", "ต้องย้ายรายการไปถังขยะก่อน"); await this.remove(tx, kind, id); await tx.auditLog.create({ data: auditData(actor, "CONTENT_DELETED_PERMANENTLY", kind, id, context) }); return { deleted: true }; }
      if (action === "trash") { if (current.deletedAt) throw new CmsError("INVALID_TRANSITION", "รายการอยู่ในถังขยะแล้ว"); await this.softDelete(tx, kind, id); await tx.auditLog.create({ data: auditData(actor, "CONTENT_TRASHED", kind, id, context) }); return { status: current.status }; }
      if (action === "restore") { if (!current.deletedAt) throw new CmsError("INVALID_TRANSITION", "รายการไม่ได้อยู่ในถังขยะ"); await this.restore(tx, kind, id); await tx.auditLog.create({ data: auditData(actor, "CONTENT_RESTORED", kind, id, context) }); return { status: ContentStatus.DRAFT }; }
      if (current.deletedAt) throw new CmsError("INVALID_TRANSITION", "ไม่สามารถเปลี่ยนสถานะรายการในถังขยะ");
      const target = action === "publish" ? ContentStatus.PUBLISHED : action === "archive" ? ContentStatus.ARCHIVED : ContentStatus.DRAFT;
      if (!canTransition(current.status, target)) throw new CmsError("INVALID_TRANSITION", "ไม่อนุญาตให้เปลี่ยนสถานะตามลำดับนี้");
      await this.setStatus(tx, kind, id, target, target === ContentStatus.PUBLISHED ? current.publishedAt ?? new Date() : target === ContentStatus.DRAFT ? null : current.publishedAt);
      await tx.auditLog.create({ data: auditData(actor, `CONTENT_${target}`, kind, id, context) }); return { status: target };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private findForUpdate(tx: Prisma.TransactionClient, kind: ContentKind, id: string) {
    const select = { id: true, status: true, slug: true, publishedAt: true, deletedAt: true, updatedAt: true };
    if (kind === "banners") return tx.banner.findUnique({ where: { id }, select: { id: true, status: true, publishedAt: true, deletedAt: true, updatedAt: true } }).then(row => row && ({ ...row, slug: null }));
    if (kind === "services") return tx.service.findUnique({ where: { id }, select });
    if (kind === "products") return tx.product.findUnique({ where: { id }, select });
    if (kind === "projects") return tx.project.findUnique({ where: { id }, select });
    return tx.news.findUnique({ where: { id }, select });
  }
  private setStatus(tx: Prisma.TransactionClient, kind: ContentKind, id: string, status: ContentStatus, date: Date | null) {
    const data = { status, publishedAt: date };
    if (kind === "banners") return tx.banner.update({ where: { id }, data }); if (kind === "services") return tx.service.update({ where: { id }, data }); if (kind === "products") return tx.product.update({ where: { id }, data }); if (kind === "projects") return tx.project.update({ where: { id }, data }); return tx.news.update({ where: { id }, data });
  }
  private softDelete(tx: Prisma.TransactionClient, kind: ContentKind, id: string) { const data = { deletedAt: new Date(), purgeAt: retentionDate() }; if (kind === "banners") return tx.banner.update({ where: { id }, data }); if (kind === "services") return tx.service.update({ where: { id }, data }); if (kind === "products") return tx.product.update({ where: { id }, data }); if (kind === "projects") return tx.project.update({ where: { id }, data }); return tx.news.update({ where: { id }, data }); }
  private restore(tx: Prisma.TransactionClient, kind: ContentKind, id: string) { const data = { deletedAt: null, purgeAt: null, status: ContentStatus.DRAFT, publishedAt: null }; if (kind === "banners") return tx.banner.update({ where: { id }, data }); if (kind === "services") return tx.service.update({ where: { id }, data }); if (kind === "products") return tx.product.update({ where: { id }, data }); if (kind === "projects") return tx.project.update({ where: { id }, data }); return tx.news.update({ where: { id }, data }); }
  private remove(tx: Prisma.TransactionClient, kind: ContentKind, id: string) { if (kind === "banners") return tx.banner.delete({ where: { id } }); if (kind === "services") return tx.service.delete({ where: { id } }); if (kind === "products") return tx.product.delete({ where: { id } }); if (kind === "projects") return tx.project.delete({ where: { id } }); return tx.news.delete({ where: { id } }); }
}
