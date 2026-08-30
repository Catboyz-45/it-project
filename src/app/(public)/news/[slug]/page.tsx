/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /news/[slug]; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { ResponsiveMedia } from "@/components/responsive-media";
import { redirectOldSlug } from "@/server/services/public-redirect.service";
import { StructuredData } from "@/components/structured-data";
import { formatThaiDate, toIsoDate } from "@/lib/date";
const content = new PublicContentService();
/** สร้าง title/description/canonical URL สำหรับหน้ารายละเอียดจากข้อมูลที่เผยแพร่; ถ้าไม่พบจะใช้ค่าเริ่มต้นที่ปลอดภัย */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const item = await content.getNews((await params).slug); return item ? createMetadata({ title: item.seoTitle ?? item.title, description: item.seoDescription ?? item.summary, path: `/news/${item.slug}`, type: "article", image: item.coverMedia ? `/api/media/${item.coverMedia.id}?format=webp&width=1280` : undefined }) : {}; }
/** สร้างส่วนหน้าจอ NewsDetail; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function NewsDetail({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = await content.getNews(slug); if (!item) { await redirectOldSlug(`/news/${slug}`, value => content.getNews(value)); notFound(); } const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yuyenengineering.co.th"; return <article><StructuredData data={{ "@context": "https://schema.org", "@type": "Article", headline: item.title, description: item.summary, datePublished: toIsoDate(item.publishedAt), dateModified: toIsoDate(item.updatedAt), mainEntityOfPage: `${siteUrl}/news/${item.slug}` }} /><section className="page-hero"><div className="container" style={{ maxWidth: 880 }}><div className="breadcrumbs"><Link href="/news">ข่าวสาร</Link><span>/</span><span>{item.category.name}</span></div><span className="tag">{item.category.name}</span><h1 className="display">{item.title}</h1>{item.publishedAt && <div className="cluster lead"><CalendarDays size={18} /> {formatThaiDate(item.publishedAt)}</div>}</div></section><section className="section"><div className="container" style={{ maxWidth: 880 }}><ResponsiveMedia media={item.coverMedia} fallbackClass="mint" className="detail-media" priority /><div style={{ maxWidth: 720, margin: "42px auto 0" }}><p className="lead">{item.summary}</p><div className="lead" style={{ whiteSpace: "pre-wrap" }}>{item.content}</div><ShareButton title={item.title} /></div></div></section></article>; }
