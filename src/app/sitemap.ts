/**
 * หน้าที่ของไฟล์นี้: สร้างรายการ URL สาธารณะให้เครื่องมือค้นหา โดยรวมเฉพาะเนื้อหาที่เผยแพร่แล้ว
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import type { MetadataRoute } from "next";
import { db } from "@/server/db";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yuyenengineering.co.th";
export const dynamic = "force-dynamic";

/** สร้างส่วนหน้าจอ sitemap; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const published = { status: "PUBLISHED" as const, deletedAt: null, publishedAt: { lte: new Date() }, isSearchable: true };
  const [services, products, projects, news] = await db.$transaction([
    db.service.findMany({ where: published, select: { slug: true, updatedAt: true } }),
    db.product.findMany({ where: published, select: { slug: true, updatedAt: true } }),
    db.project.findMany({ where: published, select: { slug: true, updatedAt: true } }),
    db.news.findMany({ where: published, select: { slug: true, updatedAt: true } }),
  ]);
  const staticPages = ["", "/about", "/services", "/products", "/projects", "/news", "/contact"];
  const entries = [
    ...staticPages.map((path) => ({ url: `${baseUrl}${path}`, changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : 0.8 })),
    ...services.map((item) => ({ url: `${baseUrl}/services/${item.slug}`, changeFrequency: "monthly" as const, priority: 0.7, lastModified: item.updatedAt })),
    ...products.map((item) => ({ url: `${baseUrl}/products/${item.slug}`, changeFrequency: "weekly" as const, priority: 0.7, lastModified: item.updatedAt })),
    ...projects.map((item) => ({ url: `${baseUrl}/projects/${item.slug}`, changeFrequency: "monthly" as const, priority: 0.6, lastModified: item.updatedAt })),
    ...news.map((item) => ({ url: `${baseUrl}/news/${item.slug}`, changeFrequency: "monthly" as const, priority: 0.6, lastModified: item.updatedAt })),
  ];
  return entries.map((entry) => ({ lastModified: new Date(), ...entry }));
}
