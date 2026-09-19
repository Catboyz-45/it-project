
import { Activity, Building2, CreditCard, DoorOpen, ShieldCheck, UsersRound } from "lucide-react";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { getSuperAdminDashboardAggregation } from "@/lib/server/dashboard-aggregation";

// แดชบอร์ดรวมของแพลตฟอร์ม เป็น Server Component จึงอ่านฐานข้อมูลตรงนี้ได้เลยไม่ต้องยิง API
export default async function SuperAdminPage() {
  // นับทุกตัวเลขมาในฟังก์ชันเดียว เลี่ยงการยิงถามหลายรอบให้หน้าโหลดช้า
  const aggregation = await getSuperAdminDashboardAggregation();

  return <>
    <SuperAdminPageHeader description="ติดตามสุขภาพของแพลตฟอร์ม สมาชิก รายได้ และงานที่ต้องดำเนินการ" title="แดชบอร์ด" />
    <section className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-6">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/[.08] px-2.5 py-1 text-xs font-semibold text-[#4651c7]"><ShieldCheck size={14} /> SUPER ADMIN</span>
      <h2 className="mt-3 max-w-3xl text-2xl font-bold tracking-[-.02em] text-[#292a30]">ภาพรวมทุกหอในแพลตฟอร์ม</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#62646c]">ใช้เมนูด้านซ้ายเพื่อจัดการบัญชี หอพัก แพ็กเกจ การชำระสมาชิก และตรวจสอบ Audit Log</p>
    </section>
    {/* ตัวเลขชุดบน เน้นเรื่องเงินและสมาชิก จำนวนคอลัมน์ปรับตามความกว้างจอ */}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Stat icon={<Building2 />} label="หอที่เปิดใช้งาน" value={aggregation.properties.active} tone="bg-brand/10 text-[#4651c7]" />
      <Stat icon={<UsersRound />} label="แอดมินประจำหอ" value={aggregation.users.PROPERTY_ADMIN ?? 0} tone="bg-pink-50 text-pink-700" />
      {/* toLocaleString("th-TH") ใส่จุลภาคให้เอง อ่านเลขหลักล้านง่ายขึ้น */}
      <Stat icon={<Activity />} label="MRR" value={`฿${aggregation.revenue.mrr.toLocaleString("th-TH")}`} tone="bg-emerald-50 text-emerald-700" />
      <Stat icon={<CreditCard />} label="สมาชิก Active" value={aggregation.subscriptions.active} tone="bg-brand/10 text-[#4651c7]" />
      <Stat icon={<DoorOpen />} label="Trial" value={aggregation.subscriptions.trial} tone="bg-pink-50 text-pink-700" />
      <Stat icon={<Activity />} label="หมดอายุใน 30 วัน" value={aggregation.subscriptions.expiringWithin30Days} tone="bg-amber-50 text-amber-700" />
    </section>
    {/* ตัวเลขชุดล่าง เป็นงานที่ต้องตามต่อ เช่น รายการรอตรวจและ ticket ที่ยังไม่ปิด */}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <CompactStat label="ห้องในระบบ" value={aggregation.usage.rooms} />
      <CompactStat label="ผู้เช่าที่ใช้งาน" value={aggregation.usage.activeTenants} />
      <CompactStat label="รายการชำระรอตรวจ" value={aggregation.operations.pendingPayments} />
      <CompactStat label="Ticket ที่ยังเปิด" value={aggregation.operations.openTickets} />
    </section>
  </>;
}

// การ์ดตัวเลขแบบมีไอคอน tone ส่งมาเป็นคลาส Tailwind เพื่อให้แต่ละใบใช้สีต่างกันได้
function Stat({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: React.ReactNode }) {
  return <article className="panel flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-md [&>svg]:size-4 ${tone}`}>{icon}</span><div><strong className="block text-xl font-semibold text-[#292a30]">{value}</strong><span className="text-sm text-[#62646c]">{label}</span></div></article>;
}

// การ์ดตัวเลขแบบเรียบ ไม่มีไอคอนและสี ใช้กับตัวเลขที่เป็นแค่จำนวนนับ
function CompactStat({ label, value }: { label: string; value: number }) {
  return <article className="panel"><span className="text-sm text-[#62646c]">{label}</span><strong className="mt-1.5 block text-xl font-semibold text-[#292a30]">{value.toLocaleString("th-TH")}</strong></article>;
}
