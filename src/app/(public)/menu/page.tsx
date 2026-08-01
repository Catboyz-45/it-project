import Link from "next/link";
import { ArrowRight } from "lucide-react";

const links = [["/", "หน้าแรก"], ["/about", "เกี่ยวกับเรา"], ["/services", "บริการ"], ["/products", "สินค้า"], ["/projects", "ผลงาน"], ["/news", "ข่าวสาร"], ["/contact", "ติดต่อเรา"]];
export default function MenuPage() { return <section className="section"><div className="container"><p className="eyebrow">MENU</p><h1 className="heading">เมนูหลัก</h1><div className="stack" style={{ marginTop: 32 }}>{links.map(([href, label]) => <Link className="card card-body cluster" style={{ justifyContent: "space-between" }} key={href} href={href}><strong>{label}</strong><ArrowRight size={18} /></Link>)}</div></div></section>; }
