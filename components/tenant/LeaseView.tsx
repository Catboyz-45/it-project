// Server Component ล้วน หน้าสัญญาเป็นการอ่านอย่างเดียว
// มีแค่ปุ่มถามหอที่เป็น island เล็ก ๆ ตอนสัญญาใกล้หมด
import { CalendarClock, FileCheck2, FileText, FileX2 } from "lucide-react";
import { AskDormButton } from "@/components/tenant/AskDormButton";
import { Empty } from "@/components/tenant/primitives";
import { currency } from "@/lib/dorm-utils";
import { formatStatus } from "@/lib/ui-labels";
import { formatThaiDate } from "@/lib/thai-format";
import { leaseTerm } from "@/lib/tenant-records";

type Lease = {
  id: string; leaseNumber: string; status: string; startDate: Date; endDate: Date;
  monthlyRent: string; depositAmount: string; currentVersion: number; hasSignedDocument: boolean;
  room?: { number: string } | null;
};

export function LeaseView({ current, upcoming }: Readonly<{ current: Lease | null; upcoming: Lease | null }>) {
  if (!current && !upcoming) {
    return <Empty description="เมื่อเจ้าของหอออกสัญญาให้แล้ว เอกสารจะมาแสดงที่นี่" icon={<FileText />} text="ยังไม่มีสัญญาที่พร้อมแสดง" />;
  }
  return <div className="grid gap-5">
    {/* ยังไม่ถึงวันเริ่มสัญญา มีแค่ใบรอบถัดไป ก็แสดงใบนั้นใบเดียว ไม่ต้องมีกล่องว่างมาคั่น */}
    {current ? <CurrentLease lease={current} /> : null}
    {upcoming ? <UpcomingLease lease={upcoming} /> : null}
  </div>;
}

function CurrentLease({ lease }: Readonly<{ lease: Lease }>) {
  const term = leaseTerm(lease.startDate, lease.endDate);
  const isEnding = term.tone === "ending";
  return <section aria-labelledby={`tenant-lease-${lease.id}`} className="grid gap-4">
    <article className="panel grid gap-5">
      <header className="flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className="tenant-icon-tile" data-tone="brand"><FileText size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[#62646c]">สัญญาปัจจุบัน</p>
          <h2 className="text-lg font-semibold text-[#292a30]" id={`tenant-lease-${lease.id}`}>{lease.leaseNumber}</h2>
          <p className="text-sm text-[#62646c]">
            {lease.room ? `ห้อง ${lease.room.number} · ` : ""}ฉบับแก้ไขที่ {lease.currentVersion}
          </p>
        </div>
        <span className={`badge ${isEnding ? "badge-pending" : "badge-paid"}`}>{formatStatus(lease.status)}</span>
      </header>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-[#62646c]">ระยะสัญญา</span>
          <strong className={isEnding ? "text-[#92400e]" : "text-[#292a30]"}>{term.remainingLabel}</strong>
        </div>
        <div
          aria-label={`ผ่านไปแล้ว ${term.percent}% ของระยะสัญญา`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={term.percent}
          className="tenant-lease-progress"
          data-tone={isEnding ? "warning" : undefined}
          role="progressbar"
        >
          <span style={{ width: `${term.percent}%` }} />
        </div>
        <div className="flex justify-between gap-3 text-sm text-[#62646c]">
          <span>เริ่ม {formatThaiDate(lease.startDate)}</span>
          <span>สิ้นสุด {formatThaiDate(lease.endDate)}</span>
        </div>
      </div>

      <dl className="tenant-lease-figures">
        <div><dt>ค่าเช่า/เดือน</dt><dd>{currency.format(Number(lease.monthlyRent))}</dd></div>
        <div><dt>เงินประกัน</dt><dd>{currency.format(Number(lease.depositAmount))}</dd></div>
        <div><dt>ระยะเวลา</dt><dd>{term.months.toLocaleString("th-TH")} เดือน</dd></div>
      </dl>

      <SignedDocumentRow lease={lease} />
    </article>

    {isEnding && term.daysLeft >= 0 ? <div className="tenant-lease-notice">
      <CalendarClock aria-hidden="true" className="shrink-0 text-[#92400e]" size={20} />
      <p className="min-w-48 flex-1 text-sm text-[#78350f]">
        สัญญาจะสิ้นสุดวันที่ {formatThaiDate(lease.endDate)} ถ้าจะต่อสัญญาหรือย้ายออก แจ้งหอล่วงหน้าเพื่อนัดตรวจห้องและคืนเงินประกัน
      </p>
      <AskDormButton label="คุยกับหอ" />
    </div> : null}
  </section>;
}

// ลิงก์ธรรมดา ไม่ต้องใช้ JavaScript เปิดไฟล์ แสดงเฉพาะเมื่อมีไฟล์จริง ไม่งั้นกดแล้วเจอหน้า error
function SignedDocumentRow({ lease }: Readonly<{ lease: Lease }>) {
  if (!lease.hasSignedDocument) {
    return <div className="tenant-lease-document is-missing">
      <FileX2 aria-hidden="true" className="shrink-0" size={20} />
      <p className="min-w-0 flex-1 text-sm">เจ้าของหอยังไม่ได้อัปโหลดไฟล์สัญญาที่ลงนามแล้ว ขอสำเนาได้ที่สำนักงานหอพัก</p>
    </div>;
  }
  return <div className="tenant-lease-document">
    <FileCheck2 aria-hidden="true" className="shrink-0 text-[#047857]" size={20} />
    <div className="min-w-48 flex-1">
      <strong className="block text-[#292a30]">สัญญาฉบับลงนาม</strong>
      <span className="block text-sm text-[#62646c]">ไฟล์ที่หออัปโหลดไว้ เปิดดูหรือดาวน์โหลดเก็บไว้ได้</span>
    </div>
    <a className="primary-button inline-flex shrink-0" href={`/api/v1/tenant/lease/signed-document?leaseId=${encodeURIComponent(lease.id)}`} rel="noreferrer" target="_blank">
      <FileText size={17} /> เปิดเอกสารลงนาม
    </a>
  </div>;
}

function UpcomingLease({ lease }: Readonly<{ lease: Lease }>) {
  const term = leaseTerm(lease.startDate, lease.endDate);
  return <section aria-labelledby={`tenant-lease-${lease.id}`} className="panel grid gap-3">
    <header className="flex flex-wrap items-start gap-3">
      <span aria-hidden="true" className="tenant-icon-tile"><CalendarClock size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#62646c]">สัญญารอบถัดไป · {term.remainingLabel}</p>
        <h2 className="font-semibold text-[#292a30]" id={`tenant-lease-${lease.id}`}>{lease.leaseNumber}</h2>
        <p className="text-sm text-[#62646c]">{formatThaiDate(lease.startDate)} – {formatThaiDate(lease.endDate)}</p>
      </div>
      {/* เปิดใช้แล้วแต่ยังไม่ถึงวันเริ่ม คำว่าใช้งานอยู่จะชวนเข้าใจผิด จึงบอกว่าลงนามแล้วแทน */}
      <span className={`badge ${lease.status === "ACTIVE" ? "badge-paid" : "badge-pending"}`}>{lease.status === "ACTIVE" ? "ลงนามแล้ว" : formatStatus(lease.status)}</span>
    </header>
    <dl className="tenant-lease-figures">
      <div><dt>ค่าเช่า/เดือน</dt><dd>{currency.format(Number(lease.monthlyRent))}</dd></div>
      <div><dt>เงินประกัน</dt><dd>{currency.format(Number(lease.depositAmount))}</dd></div>
      <div><dt>ระยะเวลา</dt><dd>{term.months.toLocaleString("th-TH")} เดือน</dd></div>
    </dl>
    <SignedDocumentRow lease={lease} />
  </section>;
}
