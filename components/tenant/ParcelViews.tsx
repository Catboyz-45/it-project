// มุมมองพัสดุทั้งสองแบบ เป็นการอ่านอย่างเดียวจึง render บนเซิร์ฟเวอร์ได้ทั้งหมด
// พัสดุรอรับเป็นการ์ดรูปใหญ่ บอกว่ารอมากี่วัน ประวัติเป็นรายการสั้น ๆ อ่านบนมือถือได้ไม่ต้องเลื่อนข้าง
import Image from "next/image";
import { Check, Package } from "lucide-react";
import { AskDormButton } from "@/components/tenant/AskDormButton";
import { Empty } from "@/components/tenant/primitives";
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai-format";
import { parcelPickupSummary, parcelWaitBadge } from "@/lib/tenant-records";

export type TenantParcel = {
  id: string; status: string; note: string | null; imageUrl: string | null;
  registeredAt: string | Date; receivedAt: string | Date | null;
};

// หมายเหตุคือสิ่งที่หอพิมพ์ไว้ตอนรับของ เช่น "กล่อง Shopee" ไม่ได้พิมพ์ก็เรียกว่าพัสดุ
const parcelName = (item: TenantParcel) => item.note?.trim() || "พัสดุ";

export function ParcelSummaryBanner({ count, roomNumber }: Readonly<{ count: number; roomNumber: string | null }>) {
  return <section aria-label="สรุปพัสดุรอรับ" className="tenant-parcel-banner">
    <span aria-hidden="true" className="tenant-icon-tile" data-tone="warning" data-size="lg"><Package size={22} /></span>
    <div className="min-w-48 flex-1">
      <h2 className="text-base font-semibold text-[#78350f]">มีพัสดุรอรับ {count.toLocaleString("th-TH")} ชิ้น</h2>
      <p className="text-sm text-[#92400e]">
        รับได้ที่สำนักงานหอ{roomNumber ? <> แจ้งเลขห้อง <strong>{roomNumber}</strong> กับเจ้าหน้าที่</> : null}
      </p>
    </div>
    <AskDormButton />
  </section>;
}

export function ParcelCard({ item, now = new Date() }: Readonly<{ item: TenantParcel; now?: Date }>) {
  const wait = parcelWaitBadge(item.registeredAt, now);
  return <li className="tenant-parcel-card">
    {item.imageUrl
      ? <Image alt={`รูป${parcelName(item)}`} className="tenant-parcel-photo" height={160} src={item.imageUrl} unoptimized width={320} />
      : <div aria-hidden="true" className="tenant-parcel-photo is-empty"><Package size={26} /><span>ไม่มีรูป</span></div>}
    <div className="grid gap-1 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold text-[#292a30]">{parcelName(item)}</h3>
        <span className="tenant-chip shrink-0" data-tone={wait.tone === "overdue" ? "danger" : "warning"}>{wait.label}</span>
      </div>
      <time className="text-sm text-[#62646c]" dateTime={new Date(item.registeredAt).toISOString()}>รับเข้า {formatThaiDateTime(item.registeredAt)}</time>
    </div>
  </li>;
}

export function ParcelGrid({ items, now = new Date() }: Readonly<{ items: TenantParcel[]; now?: Date }>) {
  return <ul aria-label="พัสดุรอรับ" className="tenant-parcel-grid">{items.map((item) => <ParcelCard item={item} key={item.id} now={now} />)}</ul>;
}

function ParcelHistoryRow({ item }: Readonly<{ item: TenantParcel }>) {
  return <li className="tenant-record-row">
    {item.imageUrl
      ? <Image alt={`รูป${parcelName(item)}`} className="size-10 shrink-0 rounded-lg object-cover" height={40} src={item.imageUrl} unoptimized width={40} />
      : <span aria-hidden="true" className="tenant-icon-tile" data-tone="success" data-size="sm"><Check size={17} /></span>}
    <div className="min-w-0 flex-1">
      <strong className="block break-words text-[#292a30]">{parcelName(item)}</strong>
      <span className="block text-sm text-[#62646c]">
        {item.receivedAt
          ? <>รับแล้ว {formatThaiDate(item.receivedAt)} · {parcelPickupSummary(item.registeredAt, item.receivedAt)}</>
          : <>รับเข้า {formatThaiDate(item.registeredAt)}</>}
      </span>
    </div>
  </li>;
}

export function ParcelHistoryRows({ items }: Readonly<{ items: TenantParcel[] }>) {
  return <ul aria-label="ประวัติการรับพัสดุ" className="tenant-record-list">{items.map((item) => <ParcelHistoryRow item={item} key={item.id} />)}</ul>;
}

export function ParcelHistoryHeading({ total }: Readonly<{ total: number | null }>) {
  return <p className="tenant-month-heading">{total === null ? "ประวัติการรับ" : `รับไปแล้วทั้งหมด ${total.toLocaleString("th-TH")} ชิ้น`}</p>;
}

export function ParcelHistoryEmpty() {
  return <Empty description="เมื่อรับพัสดุแล้วประวัติจะมาแสดงที่นี่" icon={<Package />} text="ยังไม่มีประวัติการรับพัสดุ" />;
}
