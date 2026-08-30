/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React content-cards ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { ArrowUpRight, Building2, Snowflake, Sparkles, Wrench } from "lucide-react";
import { ResponsiveMedia } from "./responsive-media";

type CardMedia = { id: string; altText?: string | null; width?: number | null; height?: number | null } | null;

const iconMap = { snowflake: Snowflake, sparkles: Sparkles, wrench: Wrench, building: Building2 };

/** สร้างส่วนหน้าจอ ServiceCard; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ServiceCard({ item }: { item: { slug: string; title: string; eyebrow: string; description: string; icon: string } }) {
  const Icon = iconMap[item.icon as keyof typeof iconMap] ?? Snowflake;
  return <Link href={`/services/${item.slug}`} className="card card-hover service-card"><span className="icon-box"><Icon size={23} /></span><p className="eyebrow" style={{ marginTop: 28 }}>{item.eyebrow}</p><h3 className="subheading">{item.title}</h3><p className="muted">{item.description}</p><ArrowUpRight className="arrow" size={20} /></Link>;
}

/** สร้างส่วนหน้าจอ ProductCard; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ProductCard({ item }: { item: { slug: string; name: string; brand: string; type: string; btu: string; feature: string; tone: string; media?: CardMedia } }) {
  return <Link href={`/products/${item.slug}`} className="card card-hover"><ResponsiveMedia media={item.media} fallbackClass={item.tone} /><div className="card-body"><div className="cluster"><span className="tag">{item.brand}</span><span className="muted" style={{ fontSize: ".8rem" }}>{item.type}</span></div><h3 className="subheading" style={{ marginTop: 16 }}>{item.name}</h3><p className="muted">{item.btu} · {item.feature}</p><span className="cluster" style={{ color: "var(--green-700)", fontWeight: 750, marginTop: 18 }}>ดูรายละเอียด <ArrowUpRight size={17} /></span></div></Link>;
}

/** สร้างส่วนหน้าจอ StoryCard; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function StoryCard({ item, type }: { item: { slug: string; title: string; tone: string; category: string; date?: string; area?: string; summary?: string; media?: CardMedia }; type: "projects" | "news" }) {
  return <Link href={`/${type}/${item.slug}`} className="card card-hover"><ResponsiveMedia media={item.media} fallbackClass={item.tone} /><div className="card-body"><span className="tag">{item.category}</span><h3 className="subheading" style={{ marginTop: 16 }}>{item.title}</h3>{item.summary && <p className="muted">{item.summary}</p>}<p className="muted" style={{ fontSize: ".82rem", marginBottom: 0 }}>{item.area ?? item.date}</p></div></Link>;
}
