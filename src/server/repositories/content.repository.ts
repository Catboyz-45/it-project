/**
 * หน้าที่ของไฟล์นี้: ชั้น repository content.repository เป็นจุดอ่านและเขียนฐานข้อมูลของโดเมนนี้ เพื่อไม่ให้ UI ติดต่อฐานข้อมูลโดยตรง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { ContentStatus, type Prisma } from "@prisma/client";
import { db } from "@/server/db/client";
import { parsePagination, toOffset, toPage, type Page, type PaginationInput } from "@/server/db/pagination";

const publicMediaSelect = { id: true, objectKey: true, altText: true, width: true, height: true } satisfies Prisma.MediaSelect;

export class ServiceRepository {
  listPublished() {
    return db.service.findMany({
      where: { status: ContentStatus.PUBLISHED, deletedAt: null, publishedAt: { lte: new Date() } },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: { coverMedia: { select: publicMediaSelect } },
    });
  }

  findPublishedBySlug(slug: string) {
    return db.service.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null, publishedAt: { lte: new Date() } },
      include: { coverMedia: { select: publicMediaSelect } },
    });
  }
}

export type ProductFilters = PaginationInput & { query?: string; brandSlug?: string; typeSlug?: string; btu?: number };

export class ProductRepository {
  async listPublished(input: ProductFilters): Promise<Page<Awaited<ReturnType<typeof this.findPublishedItems>>[number]>> {
    const pagination = parsePagination(input);
    const where: Prisma.ProductWhereInput = {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      publishedAt: { lte: new Date() },
      isSearchable: true,
      ...(input.query ? { OR: [{ name: { contains: input.query, mode: "insensitive" } }, { model: { contains: input.query, mode: "insensitive" } }] } : {}),
      ...(input.brandSlug ? { brand: { slug: input.brandSlug, deletedAt: null, isActive: true } } : {}),
      ...(input.typeSlug ? { productType: { slug: input.typeSlug, deletedAt: null, isActive: true } } : {}),
      ...(input.btu ? { AND: [{ OR: [{ btuMin: null }, { btuMin: { lte: input.btu } }] }, { OR: [{ btuMax: null }, { btuMax: { gte: input.btu } }] }] } : {}),
    };
    const [items, total] = await db.$transaction([
      this.findPublishedItems(where, toOffset(pagination), pagination.pageSize),
      db.product.count({ where }),
    ]);
    return toPage(items, total, pagination);
  }

  findPublishedBySlug(slug: string) {
    return db.product.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null, publishedAt: { lte: new Date() } },
      include: {
        brand: true,
        productType: true,
        coverMedia: { select: publicMediaSelect },
        catalogMedia: { select: publicMediaSelect },
        gallery: { orderBy: { sortOrder: "asc" }, include: { media: { select: publicMediaSelect } } },
      },
    });
  }

  private findPublishedItems(where: Prisma.ProductWhereInput, skip = 0, take = 20) {
    return db.product.findMany({
      where,
      skip,
      take,
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { name: "asc" }],
      include: { brand: true, productType: true, coverMedia: { select: publicMediaSelect } },
    });
  }
}

export class ProjectRepository {
  listPublishedTypes() { return db.project.findMany({ where: { status: ContentStatus.PUBLISHED, deletedAt: null, publishedAt: { lte: new Date() }, isSearchable: true }, distinct: ["projectType"], select: { projectType: true }, orderBy: { projectType: "asc" } }); }

  async listPublished(input: PaginationInput & { query?: string; projectType?: string } = {}) {
    const pagination = parsePagination(input);
    const where: Prisma.ProjectWhereInput = { status: ContentStatus.PUBLISHED, deletedAt: null, publishedAt: { lte: new Date() }, isSearchable: true,
      ...(input.query ? { OR: [{ title: { contains: input.query, mode: "insensitive" } }, { summary: { contains: input.query, mode: "insensitive" } }, { area: { contains: input.query, mode: "insensitive" } }] } : {}),
      ...(input.projectType ? { projectType: input.projectType } : {}),
    };
    const [items, total] = await db.$transaction([
      db.project.findMany({ where, skip: toOffset(pagination), take: pagination.pageSize, orderBy: [{ isFeatured: "desc" }, { completedAt: "desc" }], include: { coverMedia: { select: publicMediaSelect }, services: { include: { service: true } } } }),
      db.project.count({ where }),
    ]);
    return toPage(items, total, pagination);
  }

  findPublishedBySlug(slug: string) {
    return db.project.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null, publishedAt: { lte: new Date() } },
      include: { coverMedia: { select: publicMediaSelect }, gallery: { orderBy: { sortOrder: "asc" }, include: { media: { select: publicMediaSelect } } }, services: { include: { service: true } } },
    });
  }
}

export class NewsRepository {
  async listPublished(input: PaginationInput & { categorySlug?: string; query?: string }): Promise<Page<Awaited<ReturnType<typeof this.findPublishedItems>>[number]>> {
    const pagination = parsePagination(input);
    const where: Prisma.NewsWhereInput = {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      publishedAt: { lte: new Date() },
      isSearchable: true,
      ...(input.query ? { OR: [{ title: { contains: input.query, mode: "insensitive" } }, { summary: { contains: input.query, mode: "insensitive" } }] } : {}),
      ...(input.categorySlug ? { category: { slug: input.categorySlug, deletedAt: null, isActive: true } } : {}),
    };
    const [items, total] = await db.$transaction([
      this.findPublishedItems(where, toOffset(pagination), pagination.pageSize),
      db.news.count({ where }),
    ]);
    return toPage(items, total, pagination);
  }

  findPublishedBySlug(slug: string) {
    return db.news.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null, publishedAt: { lte: new Date() } },
      include: { category: true, coverMedia: { select: publicMediaSelect } },
    });
  }

  private findPublishedItems(where: Prisma.NewsWhereInput, skip = 0, take = 20) {
    return db.news.findMany({
      where,
      skip,
      take,
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      include: { category: true, coverMedia: { select: publicMediaSelect } },
    });
  }
}
