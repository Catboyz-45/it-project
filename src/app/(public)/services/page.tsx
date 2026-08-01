import { ServiceCard } from "@/components/content-cards";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";

export const metadata = createMetadata({ title: "บริการ", description: "บริการติดตั้ง ล้าง ซ่อมบำรุงเครื่องปรับอากาศ และงานระบบ M&E", path: "/services" });
export const dynamic = "force-dynamic";

export default async function ServicesPage() { const records = await new PublicContentService().listServices(); const items = records.map(item => ({ slug: item.slug, title: item.title, eyebrow: item.eyebrow ?? "SERVICE", description: item.summary, icon: "snowflake" })); return <><section className="page-hero"><div className="container"><p className="eyebrow">OUR SERVICES</p><h1 className="display">บริการของเรา</h1><p className="lead">ดูแลระบบปรับอากาศและงานวิศวกรรมอย่างครบวงจร พร้อมแนะนำแนวทางที่เหมาะสมกับแต่ละพื้นที่</p></div></section><section className="section"><div className="container"><div className="grid-2">{items.map(item => <ServiceCard key={item.slug} item={item} />)}</div>{!items.length && <p className="muted">ยังไม่มีบริการที่เผยแพร่</p>}</div></section></>; }
