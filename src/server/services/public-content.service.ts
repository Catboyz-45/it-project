/**
 * หน้าที่ของไฟล์นี้: ชั้น service public-content.service รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { z } from "zod";
import { CompanyRepository } from "@/server/repositories/company.repository";
import { NewsRepository, ProductRepository, ProjectRepository, ServiceRepository } from "@/server/repositories/content.repository";
import { TaxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";

const slugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const searchSchema = z.string().trim().transform(value => value.slice(0, 120)).optional();
const publicSlug = (value?: string) => { const parsed = value ? slugSchema.safeParse(value) : null; return parsed?.success ? parsed.data : undefined; };

export class PublicContentService {
  constructor(
    private readonly companies = new CompanyRepository(),
    private readonly services = new ServiceRepository(),
    private readonly products = new ProductRepository(),
    private readonly projects = new ProjectRepository(),
    private readonly news = new NewsRepository(),
    private readonly taxonomies = new TaxonomyRepository(),
  ) {}

  getCompany() {
    return unstable_cache(() => this.companies.findPrimary(), ["public-company"], { tags: ["public-content", "company"], revalidate: 3600 })();
  }

  getHomeBanner() { return unstable_cache(() => db.banner.findFirst({ where: { status: "PUBLISHED", deletedAt: null, publishedAt: { lte: new Date() } }, orderBy: { sortOrder: "asc" }, include: { image: { select: { id: true, altText: true, width: true, height: true } } } }), ["public-home-banner"], { tags: ["public-content", "banners"], revalidate: 1800 })(); }

  listServices() {
    return unstable_cache(() => this.services.listPublished(), ["public-services"], { tags: ["public-content", "services"], revalidate: 3600 })();
  }

  getService(slug: string) {
    const parsed = publicSlug(slug); if (!parsed) return Promise.resolve(null); return unstable_cache((value: string) => this.services.findPublishedBySlug(value), ["public-service"], { tags: ["public-content", "services"], revalidate: 3600 })(parsed);
  }

  listProducts(input: { page?: number; pageSize?: number; query?: string; brandSlug?: string; typeSlug?: string; btu?: number }) {
    const values = {
      ...input,
      query: searchSchema.parse(input.query),
      brandSlug: publicSlug(input.brandSlug),
      typeSlug: publicSlug(input.typeSlug),
    }; return unstable_cache((value: typeof values) => this.products.listPublished(value), ["public-products"], { tags: ["public-content", "products", "taxonomies"], revalidate: 1800 })(values);
  }

  getProduct(slug: string) {
    const parsed = publicSlug(slug); if (!parsed) return Promise.resolve(null); return unstable_cache((value: string) => this.products.findPublishedBySlug(value), ["public-product"], { tags: ["public-content", "products"], revalidate: 3600 })(parsed);
  }

  listProjects(input: { page?: number; pageSize?: number; query?: string; projectType?: string } = {}) {
    const values = { ...input, query: searchSchema.parse(input.query), projectType: searchSchema.parse(input.projectType) };
    return unstable_cache((value: typeof values) => this.projects.listPublished(value), ["public-projects"], { tags: ["public-content", "projects"], revalidate: 1800 })(values);
  }

  getProject(slug: string) {
    const parsed = publicSlug(slug); if (!parsed) return Promise.resolve(null); return unstable_cache((value: string) => this.projects.findPublishedBySlug(value), ["public-project"], { tags: ["public-content", "projects"], revalidate: 3600 })(parsed);
  }

  getProjectTypes() { return unstable_cache(() => this.projects.listPublishedTypes(), ["public-project-types"], { tags: ["public-content", "projects"], revalidate: 3600 })(); }

  listNews(input: { page?: number; pageSize?: number; categorySlug?: string; query?: string }) {
    const values = { ...input, query: searchSchema.parse(input.query), categorySlug: publicSlug(input.categorySlug) };
    return unstable_cache((value: typeof values) => this.news.listPublished(value), ["public-news"], { tags: ["public-content", "news", "taxonomies"], revalidate: 1800 })(values);
  }

  getNews(slug: string) {
    const parsed = publicSlug(slug); if (!parsed) return Promise.resolve(null); return unstable_cache((value: string) => this.news.findPublishedBySlug(value), ["public-news-item"], { tags: ["public-content", "news"], revalidate: 3600 })(parsed);
  }

  getProductFilters() {
    return unstable_cache(() => Promise.all([this.taxonomies.listActiveBrands(), this.taxonomies.listActiveProductTypes()]), ["public-product-filters"], { tags: ["public-content", "taxonomies"], revalidate: 3600 })();
  }

  getNewsCategories() { return unstable_cache(() => this.taxonomies.listActiveNewsCategories(), ["public-news-categories"], { tags: ["public-content", "taxonomies"], revalidate: 3600 })(); }
}
