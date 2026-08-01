import { Boxes, BriefcaseBusiness, HardDrive, Newspaper, Package, TrendingUp } from "lucide-react";
import { AdminPageHeader, SecurityNote } from "@/components/admin-shell";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";

const size = (bytes: bigint) => bytes < 1024 * 1024 ? `${(Number(bytes) / 1024).toFixed(1)} KB` : `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
export default async function DashboardPage() {
  const session = await requireAdmin();
  const [totals, publishedCounts, draftCounts, trashCounts, activities, mediaOriginals, mediaDerivatives] = await Promise.all([
    Promise.all([db.service.count({ where: { deletedAt: null } }), db.product.count({ where: { deletedAt: null } }), db.project.count({ where: { deletedAt: null } }), db.news.count({ where: { deletedAt: null } })]),
    Promise.all([db.service.count({ where: { status: "PUBLISHED", deletedAt: null } }), db.product.count({ where: { status: "PUBLISHED", deletedAt: null } }), db.project.count({ where: { status: "PUBLISHED", deletedAt: null } }), db.news.count({ where: { status: "PUBLISHED", deletedAt: null } })]),
    Promise.all([db.service.count({ where: { status: "DRAFT", deletedAt: null } }), db.product.count({ where: { status: "DRAFT", deletedAt: null } }), db.project.count({ where: { status: "DRAFT", deletedAt: null } }), db.news.count({ where: { status: "DRAFT", deletedAt: null } })]),
    Promise.all([db.service.count({ where: { deletedAt: { not: null } } }), db.product.count({ where: { deletedAt: { not: null } } }), db.project.count({ where: { deletedAt: { not: null } } }), db.news.count({ where: { deletedAt: { not: null } } })]),
    db.auditLog.findMany({ where: session.admin.role === "SUPER_ADMIN" ? {} : { actorId: session.adminId }, include: { actor: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.media.aggregate({ where: { status: "READY", kind: "PDF", deletedAt: null }, _sum: { sizeBytes: true } }),
    db.mediaVariant.aggregate({ where: { media: { status: "READY", deletedAt: null } }, _sum: { sizeBytes: true } }),
  ]);
  const published = publishedCounts.reduce((sum, value) => sum + value, 0); const drafts = draftCounts.reduce((sum, value) => sum + value, 0); const trashed = trashCounts.reduce((sum, value) => sum + value, 0); const total = published + drafts + trashed || 1;
  const mediaBytes = (mediaOriginals._sum.sizeBytes ?? BigInt(0)) + (mediaDerivatives._sum.sizeBytes ?? BigInt(0));
  const metrics = [{ label: "บริการทั้งหมด", value: totals[0], icon: BriefcaseBusiness }, { label: "สินค้าทั้งหมด", value: totals[1], icon: Package }, { label: "ผลงานทั้งหมด", value: totals[2], icon: Boxes }, { label: "ข่าวสารทั้งหมด", value: totals[3], icon: Newspaper }, { label: "พื้นที่สื่อ", value: size(mediaBytes), icon: HardDrive }];
  return <><AdminPageHeader title={`สวัสดี, ${session.admin.displayName}`} description={`ภาพรวมข้อมูลเว็บไซต์ ณ ${new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date())}`} action={<SecurityNote />} /><div className="metric-grid">{metrics.map(item => <article className="card metric-card" key={item.label}><div><p>{item.label}</p><strong>{String(item.value)}</strong></div><span className="icon-box"><item.icon size={20} /></span></article>)}</div><div className="grid-2"><section className="panel"><div className="panel-header"><h2>กิจกรรมล่าสุด</h2></div><ul className="activity">{activities.map(item => <li key={item.id}><span className="avatar">{item.actor?.displayName[0] ?? "ร"}</span><div><p><strong>{item.action}</strong></p><time>{item.actor?.displayName ?? "ระบบ"} · {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(item.createdAt)}</time></div></li>)}</ul></section><section className="panel"><div className="panel-header"><h2>สถานะเนื้อหา</h2><TrendingUp size={19} /></div><div className="card-body stack">{[["เผยแพร่แล้ว", published], ["ฉบับร่าง", drafts], ["ในถังขยะ", trashed]].map(([label, value]) => <div key={String(label)}><div className="cluster" style={{ justifyContent: "space-between" }}><span>{label}</span><strong>{value}</strong></div><div style={{ height: 8, background: "#edf1ee" }}><div style={{ width: `${Number(value) / total * 100}%`, height: "100%", background: "var(--green-700)" }} /></div></div>)}</div></section></div></>;
}
