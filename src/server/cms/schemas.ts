import { z } from "zod";

export const contentKinds = ["banners", "services", "products", "projects", "news"] as const;
export const contentKindSchema = z.enum(contentKinds);
export type ContentKind = z.infer<typeof contentKindSchema>;

const slug = z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional().transform(value => value || null);
const nullableId = z.union([z.string().trim().min(1).max(30), z.null()]).optional().transform(value => value || null);
const common = {
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
};

export const bannerSchema = z.object({
  title: z.string().trim().min(1).max(180), description: nullableText(500), buttonLabel: nullableText(80),
  buttonUrl: nullableText(500), imageId: nullableId, sortOrder: z.coerce.number().int().min(0).max(100_000).default(0), ...common,
}).strict();

export const serviceSchema = z.object({
  slug, title: z.string().trim().min(1).max(180), eyebrow: nullableText(80), summary: z.string().trim().min(1).max(500),
  content: nullableText(50_000), sortOrder: z.coerce.number().int().min(0).max(100_000).default(0), isFeatured: z.boolean().default(false),
  isSearchable: z.boolean().default(true), seoTitle: nullableText(60), seoDescription: nullableText(160), coverMediaId: nullableId, ...common,
}).strict();

export const productSchema = z.object({
  slug, name: z.string().trim().min(1).max(180), model: z.string().trim().min(1).max(120), summary: z.string().trim().min(1).max(500),
  content: nullableText(50_000), btuMin: z.number().int().positive().nullable().default(null), btuMax: z.number().int().positive().nullable().default(null),
  features: nullableText(20_000), specifications: z.record(z.string(), z.string()).nullable().default(null), warranty: nullableText(200),
  seer: z.number().positive().max(9999).nullable().default(null), refrigerant: nullableText(50), priceLabel: z.string().trim().min(1).max(80).default("สอบถามราคา"),
  isFeatured: z.boolean().default(false), isSearchable: z.boolean().default(true), seoTitle: nullableText(60), seoDescription: nullableText(160),
  brandId: z.string().min(1).max(30), productTypeId: z.string().min(1).max(30), coverMediaId: nullableId, catalogMediaId: nullableId,
  galleryMediaIds: z.array(z.string().min(1).max(30)).max(30).default([]), ...common,
}).strict().superRefine((value, context) => { if (value.btuMin && value.btuMax && value.btuMin > value.btuMax) context.addIssue({ code: "custom", path: ["btuMax"], message: "BTU สูงสุดต้องไม่น้อยกว่าค่าต่ำสุด" }); });

export const projectSchema = z.object({
  slug, title: z.string().trim().min(1).max(180), projectType: z.string().trim().min(1).max(120), area: z.string().trim().min(1).max(160),
  customerName: nullableText(180), showCustomerName: z.boolean().default(false), summary: z.string().trim().min(1).max(500), content: nullableText(50_000),
  completedAt: z.coerce.date().nullable().default(null), isFeatured: z.boolean().default(false), isSearchable: z.boolean().default(true),
  seoTitle: nullableText(60), seoDescription: nullableText(160), coverMediaId: nullableId,
  galleryMediaIds: z.array(z.string().min(1).max(30)).max(50).default([]), serviceIds: z.array(z.string().min(1).max(30)).max(30).default([]), ...common,
}).strict().superRefine((value, context) => { if (value.showCustomerName && !value.customerName) context.addIssue({ code: "custom", path: ["customerName"], message: "ต้องระบุชื่อลูกค้าก่อนเปิดเผย" }); });

export const newsSchema = z.object({
  slug, title: z.string().trim().min(1).max(180), summary: z.string().trim().min(1).max(500), content: nullableText(50_000),
  isFeatured: z.boolean().default(false), isSearchable: z.boolean().default(true), seoTitle: nullableText(60), seoDescription: nullableText(160),
  categoryId: z.string().min(1).max(30), coverMediaId: nullableId, publishedAt: z.coerce.date().nullable().default(null), ...common,
}).strict();

export const schemas = { banners: bannerSchema, services: serviceSchema, products: productSchema, projects: projectSchema, news: newsSchema };

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).default(""), status: z.enum(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"]).default("ALL"),
  sort: z.enum(["updated-desc", "updated-asc", "title-asc", "title-desc"]).default("updated-desc"),
}).strict();

export const transitionSchema = z.object({ action: z.enum(["publish", "unpublish", "archive", "trash", "restore", "delete"]) }).strict();

export const taxonomyKinds = ["brands", "product-types", "news-categories"] as const;
export const taxonomyKindSchema = z.enum(taxonomyKinds);
export type TaxonomyKind = z.infer<typeof taxonomyKindSchema>;
export const taxonomySchema = z.object({ name: z.string().trim().min(1).max(120), slug: slug.max(120), sortOrder: z.coerce.number().int().min(0).max(100_000).default(0), isActive: z.boolean().default(true) }).strict();
