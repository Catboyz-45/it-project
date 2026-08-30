/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /projects/[slug]; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { ResponsiveMedia } from "@/components/responsive-media";
import { redirectOldSlug } from "@/server/services/public-redirect.service";
import { formatThaiDate } from "@/lib/date";
const content = new PublicContentService();
/** สร้าง title/description/canonical URL สำหรับหน้ารายละเอียดจากข้อมูลที่เผยแพร่; ถ้าไม่พบจะใช้ค่าเริ่มต้นที่ปลอดภัย */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const item = await content.getProject((await params).slug); return item ? createMetadata({ title: item.seoTitle ?? item.title, description: item.seoDescription ?? item.summary, path: `/projects/${item.slug}`, image: item.coverMedia ? `/api/media/${item.coverMedia.id}?format=webp&width=1280` : undefined }) : {}; }
/** สร้างส่วนหน้าจอ ProjectDetail; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = await content.getProject(slug); if (!item) { await redirectOldSlug(`/projects/${slug}`, value => content.getProject(value)); notFound(); } return <><section className="page-hero"><div className="container"><div className="breadcrumbs"><Link href="/projects">ผลงาน</Link><span>/</span><span>{item.title}</span></div><span className="tag">{item.projectType}</span><h1 className="display">{item.title}</h1><div className="cluster lead"><span className="cluster"><MapPin size={18} /> {item.area}</span>{item.completedAt && <span className="cluster"><CalendarDays size={18} /> {formatThaiDate(item.completedAt)}</span>}</div></div></section><section className="section"><div className="container"><div className="detail-grid"><ResponsiveMedia media={item.coverMedia} fallbackClass="office" className="detail-media" priority /><div><h2 className="heading">ภาพรวมโครงการ</h2><p className="lead">{item.summary}</p><div style={{ whiteSpace: "pre-wrap" }}>{item.content}</div>{item.showCustomerName && item.customerName && <p>ลูกค้า: {item.customerName}</p>}</div></div>{item.gallery.length > 0 && <div className="grid-3" style={{ marginTop: 36 }}>{item.gallery.map(entry => <ResponsiveMedia key={entry.media.id} media={entry.media} />)}</div>}</div></section></>; }
