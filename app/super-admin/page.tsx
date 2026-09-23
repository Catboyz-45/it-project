
import { Activity, Building2, CreditCard, DoorOpen, UsersRound } from "lucide-react";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { getSuperAdminDashboardAggregation } from "@/lib/server/dashboard-aggregation";

// แดชบอร์ดรวมของแพลตฟอร์ม เป็น Server Component จึงอ่านฐานข้อมูลตรงนี้ได้เลยไม่ต้องยิง API
export default async function SuperAdminPage() {
  // นับทุกตัวเลขมาในฟังก์ชันเดียว เลี่ยงการยิงถามหลายรอบให้หน้าโหลดช้า
  const aggregation = await getSuperAdminDashboardAggregation();

  return <>
    <SuperAdminPageHeader description="ติดตามสุขภาพของแพลตฟอร์ม สมาชิก รายได้ และงานที่ต้องดำเนินการ" title="แดชบอร์ด" />
    {/* ใช้การ์ดตัวเลขใบเดียวกับฝั่งเจ้าของหอและผู้เช่า จะได้เป็นภาษาเดียวกันทั้งสามโรล
        เดิมหน้านี้มีการ์ดสองแบบปนกัน แบบมีไอคอนกับแบบไม่มี ซึ่งอ่านเหมือนคนละระบบ */}
    <section className="figma-summary-grid three">
      <Stat icon={<Building2 />} label="หอที่เปิดใช้งาน" tone="indigo" value={aggregation.properties.active} />
      <Stat icon={<UsersRound />} label="แอดมินประจำหอ" tone="indigo" value={aggregation.users.PROPERTY_ADMIN ?? 0} />
      {/* toLocaleString("th-TH") ใส่จุลภาคให้เอง อ่านเลขหลักล้านง่ายขึ้น */}
      <Stat icon={<Activity />} label="MRR" tone="green" value={`฿${aggregation.revenue.mrr.toLocaleString("th-TH")}`} />
      <Stat icon={<CreditCard />} label="สมาชิก Active" tone="green" value={aggregation.subscriptions.active} />
      <Stat icon={<DoorOpen />} label="Trial" tone="blue" value={aggregation.subscriptions.trial} />
      <Stat icon={<Activity />} label="หมดอายุใน 30 วัน" tone="orange" value={aggregation.subscriptions.expiringWithin30Days} />
    </section>
    {/* ตัวเลขชุดล่าง เป็นงานที่ต้องตามต่อ เช่น รายการรอตรวจและ ticket ที่ยังไม่ปิด */}
    <section className="figma-summary-grid four">
      <Stat icon={<DoorOpen />} label="ห้องในระบบ" tone="indigo" value={aggregation.usage.rooms} />
      <Stat icon={<UsersRound />} label="ผู้เช่าที่ใช้งาน" tone="indigo" value={aggregation.usage.activeTenants} />
      <Stat icon={<CreditCard />} label="รายการชำระรอตรวจ" tone="orange" value={aggregation.operations.pendingPayments} />
      <Stat icon={<Activity />} label="Ticket ที่ยังเปิด" tone="orange" value={aggregation.operations.openTickets} />
    </section>
  </>;
}

// การ์ดตัวเลขใบเดียวกับที่ฝั่งเจ้าของหอใช้ tone คุมสีของไอคอนอย่างเดียว ไม่ได้คุมสีตัวเลข
function Stat({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: React.ReactNode }) {
  return <article className={`figma-summary-card tone-${tone}`}>
    <div><small>{label}</small><strong>{value}</strong></div>
    <span>{icon}</span>
  </article>;
}

