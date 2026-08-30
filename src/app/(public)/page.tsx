/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /(public); เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Headphones, MapPin, Phone, ShieldCheck } from "lucide-react";
import { ProductCard, ServiceCard, StoryCard } from "@/components/content-cards";
import { SectionLink } from "@/components/site-shell";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { ResponsiveMedia } from "@/components/responsive-media";
import { formatThaiDate } from "@/lib/date";

export const metadata = createMetadata({ title: "หน้าแรก", description: "บริการจำหน่าย ติดตั้ง ล้าง และซ่อมบำรุงระบบปรับอากาศ พร้อมงานระบบ M&E", path: "/" });
export const dynamic = "force-dynamic";
import { companyPublicConfig as fallbackCompany } from "@/lib/public-config";

/** สร้างส่วนหน้าจอ HomePage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function HomePage() {
  const content = new PublicContentService();
  const [serviceRecords, productResult, projectRecords, newsResult, banner, companyRecord] = await Promise.all([content.listServices(), content.listProducts({ pageSize: 4 }), content.listProjects({ pageSize: 3 }), content.listNews({ pageSize: 3 }), content.getHomeBanner(), content.getCompany()]);
  const company = { phoneHref: companyRecord?.phoneHref ?? fallbackCompany.phoneHref };
  const services = serviceRecords.slice(0, 4).map(item => ({ slug: item.slug, title: item.title, eyebrow: item.eyebrow ?? "SERVICE", description: item.summary, icon: "snowflake" }));
  const products = productResult.items.map(item => ({ slug: item.slug, name: item.name, brand: item.brand.name, type: item.productType.name, btu: item.btuMin && item.btuMax ? `${item.btuMin.toLocaleString()}–${item.btuMax.toLocaleString()} BTU` : "สอบถามขนาด", feature: item.summary, tone: "silver", media: item.coverMedia }));
  const projects = projectRecords.items.map(item => ({ slug: item.slug, title: item.title, category: item.projectType, area: item.area, summary: item.summary, tone: "office", media: item.coverMedia }));
  const news = newsResult.items.map(item => ({ slug: item.slug, title: item.title, category: item.category.name, date: formatThaiDate(item.publishedAt), summary: item.summary, tone: "mint", media: item.coverMedia }));
  return (
    <>
      <section className="hero">
        {banner?.image && <ResponsiveMedia media={banner.image} className="hero-media" priority />}
        <div className="container hero-content">
          <span className="hero-badge"><BadgeCheck size={16} /> ดูแลโดยทีมช่างผู้มีประสบการณ์</span>
          <h1 className="display">{banner?.title ?? "เย็นสบาย มั่นใจได้ในทุกพื้นที่ของคุณ"}</h1>
          <p className="lead">{banner?.description ?? "ครบทุกเรื่องระบบปรับอากาศ ตั้งแต่จำหน่าย ติดตั้ง ล้าง ซ่อมบำรุง ไปจนถึงงานระบบ M&E"}</p>
          <div className="cluster" style={{ marginTop: 32 }}><Link className="btn btn-primary" href="/services">ดูบริการของเรา <ArrowRight size={18} /></Link><Link className="btn btn-outline" style={{ borderColor: "rgba(255,255,255,.4)", color: "white" }} href="/contact"><Phone size={17} /> ติดต่อสอบถาม</Link></div>
        </div>
      </section>

      <div className="container hero-stats">
        <div className="stats-card">
          <div className="stat"><span className="icon-box"><ShieldCheck size={22} /></span><div><strong>มาตรฐาน</strong><span>ใส่ใจทุกขั้นตอนการทำงาน</span></div></div>
          <div className="stat"><span className="icon-box"><Clock3 size={22} /></span><div><strong>ตรงเวลา</strong><span>นัดหมายชัดเจน ทำงานเป็นระบบ</span></div></div>
          <div className="stat"><span className="icon-box"><Headphones size={22} /></span><div><strong>ดูแลต่อเนื่อง</strong><span>พร้อมให้คำแนะนำหลังส่งมอบ</span></div></div>
        </div>
      </div>

      <section className="section"><div className="container"><div className="section-head"><div><p className="eyebrow">OUR SERVICES</p><h2 className="heading">บริการที่ดูแลได้ครบ<br />ตั้งแต่ต้นจนจบ</h2></div><SectionLink href="/services">ดูบริการทั้งหมด</SectionLink></div><div className="grid-4">{services.map(item => <ServiceCard key={item.slug} item={item} />)}</div></div></section>

      <section className="section" style={{ background: "var(--cream-100)" }}><div className="container"><div className="section-head"><div><p className="eyebrow">RECOMMENDED PRODUCTS</p><h2 className="heading">สินค้าที่คัดสรรเพื่อพื้นที่ของคุณ</h2><p className="lead">เลือกดูตามยี่ห้อ ประเภท และขนาด BTU พร้อมให้ทีมงานช่วยแนะนำรุ่นที่เหมาะสม</p></div><SectionLink href="/products">ดูสินค้าทั้งหมด</SectionLink></div><div className="grid-4">{products.map(item => <ProductCard key={item.slug} item={item} />)}</div></div></section>

      <section className="section band"><div className="container"><div className="section-head"><div><p className="eyebrow" style={{ color: "var(--lime-400)" }}>HOW WE WORK</p><h2 className="heading">ทุกงานเริ่มจากความเข้าใจ<br />และจบด้วยความเรียบร้อย</h2></div></div><div className="process"><div className="process-item"><h3>รับข้อมูล</h3><p>รับฟังความต้องการและรายละเอียดพื้นที่เบื้องต้น</p></div><div className="process-item"><h3>สำรวจหน้างาน</h3><p>ตรวจสอบพื้นที่จริงและประเมินแนวทางที่เหมาะสม</p></div><div className="process-item"><h3>เสนอแนวทาง</h3><p>อธิบายขอบเขตงาน อุปกรณ์ และระยะเวลาดำเนินการ</p></div><div className="process-item"><h3>ติดตั้งและดูแล</h3><p>ดำเนินงานตามมาตรฐาน พร้อมตรวจเช็กก่อนส่งมอบ</p></div></div></div></section>

      <section className="section"><div className="container"><div className="section-head"><div><p className="eyebrow">OUR PROJECTS</p><h2 className="heading">ผลงานที่เราภูมิใจ</h2></div><SectionLink href="/projects">ดูผลงานทั้งหมด</SectionLink></div><div className="grid-3">{projects.map(item => <StoryCard key={item.slug} item={item} type="projects" />)}</div></div></section>

      <section className="section" style={{ background: "var(--cream-100)" }}><div className="container"><div className="section-head"><div><p className="eyebrow">NEWS & KNOWLEDGE</p><h2 className="heading">ข่าวสารและสาระน่ารู้</h2></div><SectionLink href="/news">ดูทั้งหมด</SectionLink></div><div className="grid-3">{news.map(item => <StoryCard key={item.slug} item={item} type="news" />)}</div></div></section>

      <section className="section"><div className="container"><div className="cta"><div><p className="eyebrow" style={{ color: "var(--lime-400)" }}>LET&apos;S TALK</p><h2 className="heading">กำลังมองหาทีมดูแลระบบปรับอากาศ?</h2><p style={{ color: "rgba(255,255,255,.7)" }}>พูดคุยกับเราเพื่อรับคำแนะนำเบื้องต้นโดยไม่มีค่าใช้จ่าย</p></div><div className="cluster cta-actions"><a className="btn btn-white" href={`tel:${company.phoneHref}`}><Phone size={18} /> โทรหาเรา</a><Link className="btn btn-primary" href="/contact"><MapPin size={18} /> ช่องทางติดต่อ</Link></div></div></div></section>
    </>
  );
}
