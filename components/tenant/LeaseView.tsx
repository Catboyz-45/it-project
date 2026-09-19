// Server Component ล้วน หน้าสัญญาเป็นการอ่านอย่างเดียว ไม่มีอะไรให้กด
// จึงไม่ต้องส่ง JavaScript ไปที่เบราว์เซอร์เลยสักบรรทัด
import { FileText } from "lucide-react";
import { Empty, Info, Panel } from "@/components/tenant/primitives";
import { currency } from "@/lib/dorm-utils";
import { formatStatus } from "@/lib/ui-labels";

type Lease = {
  id: string; leaseNumber: string; status: string; startDate: Date; endDate: Date;
  monthlyRent: string; depositAmount: string; currentVersion: number;
};

export function LeaseView({ current, upcoming }: { current: Lease | null; upcoming: Lease | null }) {
  if (!current && !upcoming) {
    return <Empty description="เมื่อเจ้าของหอออกสัญญาให้แล้ว เอกสารจะมาแสดงที่นี่" icon={<FileText />} text="ยังไม่มีสัญญาที่พร้อมแสดง" />;
  }
  return <div className="grid gap-5">
    {current
      ? <LeaseCard lease={current} title="สัญญาปัจจุบัน" />
      : <Empty description="สัญญาที่สิ้นสุดแล้วยังเปิดดูได้จากประวัติด้านล่าง" icon={<FileText />} text="ไม่มีสัญญาที่กำลังใช้งานในขณะนี้" />}
    {upcoming ? <LeaseCard lease={upcoming} title="สัญญารอบถัดไป" /> : null}
  </div>;
}

function LeaseCard({ lease, title }: { lease: Lease; title: string }) {
  return <section aria-labelledby={`tenant-lease-${lease.id}`} className="grid gap-2">
    <h2 className="text-base font-semibold text-[#292a30]" id={`tenant-lease-${lease.id}`}>{title}</h2>
    <Panel title={lease.leaseNumber}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Info label="สถานะ" value={formatStatus(lease.status)} />
        <Info label="Version" value={`v${lease.currentVersion}`} />
        <Info label="วันเริ่มต้น" value={lease.startDate.toLocaleDateString("th-TH")} />
        <Info label="วันสิ้นสุด" value={lease.endDate.toLocaleDateString("th-TH")} />
        <Info label="ค่าเช่า" value={currency.format(Number(lease.monthlyRent))} />
        <Info label="เงินประกัน" value={currency.format(Number(lease.depositAmount))} />
      </div>
      {/* ลิงก์ธรรมดา ไม่ต้องใช้ JavaScript เปิดไฟล์ */}
      <a className="primary-button mt-5 inline-flex" href={`/api/v1/tenant/lease/signed-document?leaseId=${encodeURIComponent(lease.id)}`} rel="noreferrer" target="_blank">
        <FileText size={17} /> เปิดเอกสารลงนาม
      </a>
    </Panel>
  </section>;
}
