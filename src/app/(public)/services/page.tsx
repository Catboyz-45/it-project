/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /services; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { ServiceCard } from "@/components/content-cards";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";

/** ข้อมูลชื่อและคำอธิบายของหน้าที่เครื่องมือค้นหาและแท็บเบราว์เซอร์ใช้ */
export const metadata = createMetadata({ title: "บริการ", description: "บริการติดตั้ง ล้าง ซ่อมบำรุงเครื่องปรับอากาศ และงานระบบ M&E", path: "/services" });
/** บังคับอ่านข้อมูลล่าสุดทุกคำขอ เพราะรายการบริการแก้ไขได้จาก CMS */
export const dynamic = "force-dynamic";

/** สร้างส่วนหน้าจอ ServicesPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function ServicesPage() { const records = await new PublicContentService().listServices(); const items = records.map(item => ({ slug: item.slug, title: item.title, eyebrow: item.eyebrow ?? "SERVICE", description: item.summary, icon: "snowflake" })); return <><section className="page-hero"><div className="container"><p className="eyebrow">OUR SERVICES</p><h1 className="display">บริการของเรา</h1><p className="lead">ดูแลระบบปรับอากาศและงานวิศวกรรมอย่างครบวงจร พร้อมแนะนำแนวทางที่เหมาะสมกับแต่ละพื้นที่</p></div></section><section className="section"><div className="container"><div className="grid-2">{items.map(item => <ServiceCard key={item.slug} item={item} />)}</div>{!items.length && <p className="muted">ยังไม่มีบริการที่เผยแพร่</p>}</div></section></>; }
