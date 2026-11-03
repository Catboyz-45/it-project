// การ์ดและรายการประกาศ ไม่มี state จึงเป็น Server Component ได้
// ประกาศล่าสุดขึ้นเป็นการ์ดใหญ่ ที่เหลือเรียงเป็นรายการตามเดือน กดที่แถวเพื่ออ่านเต็ม ๆ
import { Building, Building2, ChevronDown, DoorOpen, Layers, Megaphone } from "lucide-react";
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai-format";
import {
  isRecentAnnouncement, relativeThaiTime, thaiMonthKey, thaiMonthLabel, type AnnouncementAudience,
} from "@/lib/tenant-records";

export type TenantAnnouncement = {
  id: string; title: string; content: string;
  audience: AnnouncementAudience; audienceLabel: string;
  publishedAt: string | Date | null; publishAt: string | Date | null; createdAt: string | Date;
};

// เผยแพร่แล้วใช้เวลาเผยแพร่ ยังไม่ถึงเวลาก็ใช้เวลาที่ตั้งไว้ ไม่มีทั้งคู่ค่อยใช้เวลาสร้าง
export function announcementShownAt(item: Pick<TenantAnnouncement, "publishedAt" | "publishAt" | "createdAt">) {
  return item.publishedAt ?? item.publishAt ?? item.createdAt;
}

const audienceIcon = { ALL_TENANTS: Building2, BUILDING: Building, FLOOR: Layers, ROOM: DoorOpen } as const;

function AudienceChip({ item }: Readonly<{ item: TenantAnnouncement }>) {
  const Icon = audienceIcon[item.audience];
  return <span className="tenant-chip" data-tone={item.audience === "ROOM" ? "success" : undefined}>
    <Icon aria-hidden="true" size={13} /> {item.audienceLabel}
  </span>;
}

export function FeaturedAnnouncement({ item, now = new Date() }: Readonly<{ item: TenantAnnouncement; now?: Date }>) {
  const shownAt = announcementShownAt(item);
  const relative = relativeThaiTime(shownAt, now);
  return <article aria-labelledby={`announcement-${item.id}`} className="tenant-featured-announcement">
    <span aria-hidden="true" className="tenant-icon-tile" data-tone="brand"><Megaphone size={20} /></span>
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {isRecentAnnouncement(shownAt, now) ? <span className="tenant-chip" data-tone="brand">ใหม่</span> : null}
        <AudienceChip item={item} />
      </div>
      <h2 className="text-lg font-semibold text-[#292a30]" id={`announcement-${item.id}`}>{item.title}</h2>
      <p className="mt-2 whitespace-pre-wrap leading-7 text-[#3f4048]">{item.content}</p>
      <time className="mt-3 block text-sm text-[#62646c]" dateTime={new Date(shownAt).toISOString()}>
        {relative ? `${relative} · ` : ""}{formatThaiDateTime(shownAt)}
      </time>
    </div>
  </article>;
}

// แถวพับได้ ใช้ details ของเบราว์เซอร์ ไม่ต้องมี JavaScript ก็กดเปิดอ่านได้
function AnnouncementRow({ item, now }: Readonly<{ item: TenantAnnouncement; now: Date }>) {
  const shownAt = announcementShownAt(item);
  const Icon = audienceIcon[item.audience];
  const meta = <>
    <AudienceChip item={item} />
    <time dateTime={new Date(shownAt).toISOString()}>{relativeThaiTime(shownAt, now) ?? formatThaiDate(shownAt)}</time>
  </>;
  return <li>
    <details className="tenant-announcement-row">
      <summary>
        <span aria-hidden="true" className="tenant-icon-tile"><Icon size={18} /></span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[#292a30]">{item.title}</strong>
          <span className="tenant-announcement-excerpt">{item.content}</span>
          {/* จอแคบไม่มีที่ด้านขวา ป้ายผู้รับกับวันที่จึงลงมาอยู่ใต้ข้อความแทน */}
          <span className="tenant-announcement-meta-inline">{meta}</span>
        </span>
        <span className="tenant-announcement-meta">{meta}</span>
        <ChevronDown aria-hidden="true" className="tenant-announcement-chevron" size={18} />
      </summary>
      <div className="tenant-announcement-body">
        <p className="whitespace-pre-wrap leading-7">{item.content}</p>
        <time className="mt-2 block text-sm text-[#62646c]">{formatThaiDateTime(shownAt)}</time>
      </div>
    </details>
  </li>;
}

// จัดกลุ่มตามเดือน previousMonthKey คือเดือนของรายการสุดท้ายที่แสดงไปแล้ว
// รายการที่กดโหลดเพิ่มจะได้ไม่ขึ้นหัวเดือนเดิมซ้ำ
export function AnnouncementMonthList({ items, now = new Date(), previousMonthKey }: Readonly<{
  items: TenantAnnouncement[]; now?: Date; previousMonthKey?: string;
}>) {
  const groups: Array<{ key: string; label: string; items: TenantAnnouncement[] }> = [];
  for (const item of items) {
    const shownAt = announcementShownAt(item);
    const key = thaiMonthKey(shownAt);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: thaiMonthLabel(shownAt), items: [item] });
  }
  return <>
    {groups.map((group) => <section aria-label={group.label} className="grid gap-2" key={group.key}>
      {group.key === previousMonthKey ? null : <h2 className="tenant-month-heading">{group.label}</h2>}
      <ul className="tenant-record-list">{group.items.map((item) => <AnnouncementRow item={item} key={item.id} now={now} />)}</ul>
    </section>)}
  </>;
}
