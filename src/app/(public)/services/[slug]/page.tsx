/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /services/[slug]; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { ResponsiveMedia } from "@/components/responsive-media";
import { redirectOldSlug } from "@/server/services/public-redirect.service";
const content = new PublicContentService();
/** สร้าง title/description/canonical URL สำหรับหน้ารายละเอียดจากข้อมูลที่เผยแพร่; ถ้าไม่พบจะใช้ค่าเริ่มต้นที่ปลอดภัย */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const item = await content.getService((await params).slug); return item ? createMetadata({ title: item.seoTitle ?? item.title, description: item.seoDescription ?? item.summary, path: `/services/${item.slug}`, image: item.coverMedia ? `/api/media/${item.coverMedia.id}?format=webp&width=1280` : undefined }) : {}; }
/** สร้างส่วนหน้าจอ ServiceDetail; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function ServiceDetail({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = await content.getService(slug); if (!item) { await redirectOldSlug(`/services/${slug}`, value => content.getService(value)); notFound(); } return <><section className="page-hero"><div className="container"><div className="breadcrumbs"><Link href="/services">บริการ</Link><span>/</span><span>{item.title}</span></div><p className="eyebrow">{item.eyebrow ?? "SERVICE"}</p><h1 className="display">{item.title}</h1><p className="lead">{item.summary}</p></div></section><section className="section"><div className="container detail-grid"><div><h2 className="heading">รายละเอียดบริการ</h2><div className="lead" style={{ whiteSpace: "pre-wrap" }}>{item.content ?? item.summary}</div><div className="cluster" style={{ marginTop: 34 }}><Link className="btn btn-primary" href="/contact"><Phone size={17} /> ติดต่อสอบถาม</Link><Link className="btn btn-ghost" href="/services"><ArrowLeft size={17} /> กลับไปหน้าบริการ</Link></div></div><ResponsiveMedia media={item.coverMedia} fallbackClass="building" className="detail-media" priority /></div></section></>; }
