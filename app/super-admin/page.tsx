import Link from "next/link";
import { Activity, Building2, ChevronRight, CreditCard, DoorOpen, Gauge, ListChecks, UsersRound, Wrench } from "lucide-react";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { AppSection } from "@/components/ui/AppSection";
import { getSuperAdminDashboardAggregation } from "@/lib/server/dashboard-aggregation";

// แดชบอร์ดรวมของแพลตฟอร์ม เป็น Server Component จึงอ่านฐานข้อมูลตรงนี้ได้เลยไม่ต้องยิง API
export default async function SuperAdminPage() {
  // นับทุกตัวเลขมาในฟังก์ชันเดียว เลี่ยงการยิงถามหลายรอบให้หน้าโหลดช้า
  const aggregation = await getSuperAdminDashboardAggregation();

  // งานที่ค้างอยู่ของผู้ดูแลระบบ แสดงเฉพาะที่มีจำนวนจริง เหมือนหน้าแรกของอีกสองโรล
  const workItems = [
    {
      count: aggregation.operations.pendingPayments,
      detail: "ตรวจหลักฐานการชำระค่าสมาชิก",
      href: "/super-admin/subscriptions",
      icon: <CreditCard size={20} />,
      title: "การชำระรอตรวจ",
    },
    {
      count: aggregation.subscriptions.expiringWithin30Days,
      detail: "แพ็กเกจที่หมดอายุภายใน 30 วัน",
      href: "/super-admin/properties",
      icon: <Activity size={20} />,
      title: "แพ็กเกจใกล้หมดอายุ",
    },
    {
      count: aggregation.operations.openTickets,
      detail: "เรื่องแจ้งที่ยังไม่ปิดในทุกหอ",
      href: "/super-admin/properties",
      icon: <Wrench size={20} />,
      title: "เรื่องที่ยังไม่ปิด",
    },
  ].filter((item) => item.count > 0);

  return <>
    <SuperAdminPageHeader description="ติดตามสุขภาพของแพลตฟอร์ม สมาชิก รายได้ และงานที่ต้องดำเนินการ" title="แดชบอร์ด" />

    {/* เรียงเป็นส่วน ๆ แบบเดียวกับหน้าแรกของเจ้าของหอและผู้เช่า
        เดิมหน้านี้เป็นตัวเลขลอย ๆ สามแถวโดยไม่มีหัวข้อบอกว่าแต่ละแถวคืออะไร */}
    <AppSection description="จำนวนหอ ผู้ดูแล และรายได้ต่อเดือน" icon={<Gauge />} title="ภาพรวมแพลตฟอร์ม">
      <div className="figma-summary-grid three">
        <Stat icon={<Building2 />} label="หอที่เปิดใช้งาน" tone="indigo" value={aggregation.properties.active} />
        <Stat icon={<UsersRound />} label="แอดมินประจำหอ" tone="indigo" value={aggregation.users.PROPERTY_ADMIN ?? 0} />
        {/* toLocaleString("th-TH") ใส่จุลภาคให้เอง อ่านเลขหลักล้านง่ายขึ้น */}
        <Stat icon={<Activity />} label="MRR" tone="green" value={`฿${aggregation.revenue.mrr.toLocaleString("th-TH")}`} />
      </div>
    </AppSection>

    <AppSection
      aside={workItems.length > 0 ? `${workItems.reduce((total, item) => total + item.count, 0)} รายการรอดำเนินการ` : "ไม่มีรายการค้าง"}
      description="รายการที่ต้องเข้าไปจัดการในตอนนี้"
      icon={<ListChecks />}
      title="งานที่ต้องทำ"
    >
      {workItems.length > 0 ? (
        <div className="work-item-grid">
          {workItems.map((item) => (
            <Link href={item.href} key={item.title}>
              <span className="work-item-icon">{item.icon}</span>
              <span className="work-item-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
              <span className="work-item-count">{item.count > 99 ? "99+" : item.count}</span>
              <ChevronRight aria-hidden="true" className="work-item-arrow" size={20} />
            </Link>
          ))}
        </div>
      ) : <p className="rounded-xl border border-[#e4e4e7] bg-[#fff] p-4 text-sm text-[#62646c]">ไม่มีรายการที่ต้องดำเนินการในตอนนี้</p>}
    </AppSection>

    <AppSection description="สถานะแพ็กเกจของหอทั้งหมด" icon={<CreditCard />} title="สมาชิก">
      <div className="figma-summary-grid three">
        <Stat icon={<CreditCard />} label="สมาชิก Active" tone="green" value={aggregation.subscriptions.active} />
        <Stat icon={<DoorOpen />} label="Trial" tone="blue" value={aggregation.subscriptions.trial} />
        <Stat icon={<Activity />} label="หมดอายุใน 30 วัน" tone="orange" value={aggregation.subscriptions.expiringWithin30Days} />
      </div>
    </AppSection>

    <AppSection description="ปริมาณข้อมูลที่หอทั้งหมดใช้งานอยู่" icon={<DoorOpen />} title="การใช้งานจริง">
      <div className="figma-summary-grid three">
        <Stat icon={<DoorOpen />} label="ห้องในระบบ" tone="indigo" value={aggregation.usage.rooms} />
        <Stat icon={<UsersRound />} label="ผู้เช่าที่ใช้งาน" tone="indigo" value={aggregation.usage.activeTenants} />
        <Stat icon={<Wrench />} label="Ticket ที่ยังเปิด" tone="orange" value={aggregation.operations.openTickets} />
      </div>
    </AppSection>
  </>;
}

// การ์ดตัวเลขใบเดียวกับที่ฝั่งเจ้าของหอใช้ tone คุมสีของไอคอนอย่างเดียว ไม่ได้คุมสีตัวเลข
function Stat({ icon, label, tone, value }: Readonly<{ icon: React.ReactNode; label: string; tone: string; value: React.ReactNode }>) {
  return <article className={`figma-summary-card tone-${tone}`}>
    <div><small>{label}</small><strong>{value}</strong></div>
    <span>{icon}</span>
  </article>;
}
