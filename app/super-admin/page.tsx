import Link from "next/link";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { getSuperAdminDashboardAggregation } from "@/lib/server/dashboard-aggregation";

// แดชบอร์ดรวมของแพลตฟอร์ม เป็น Server Component จึงอ่านฐานข้อมูลตรงนี้ได้เลยไม่ต้องยิง API
// ใช้โครงเดียวกับหน้าแรกของเจ้าของหอ ตัวเลขสำคัญหนึ่งแถว แล้วตามด้วยงานที่ต้องทำและการใช้งานจริง
export default async function SuperAdminPage() {
  // นับทุกตัวเลขมาในฟังก์ชันเดียว เลี่ยงการยิงถามหลายรอบให้หน้าโหลดช้า
  const aggregation = await getSuperAdminDashboardAggregation();
  const { operations, subscriptions, usage } = aggregation;

  // งานที่ค้างอยู่ของผู้ดูแลระบบ แสดงเฉพาะที่มีจำนวนจริง ทั้งสองเรื่องเป็นงานรอทำ จึงเป็นป้ายสีเหลือง
  // เรื่องแจ้งซ่อมเป็นงานของเจ้าของหอแต่ละหอ ผู้ดูแลระบบปิดเองไม่ได้ จึงแสดงเป็นตัวเลขในการใช้งานจริงแทน
  const todos = [
    {
      action: "ตรวจสลิป",
      count: operations.pendingPayments,
      detail: "ยืนยันแล้วแพ็กเกจของหอต่ออายุให้ทันที",
      href: "/super-admin/subscriptions",
      label: "รอตรวจ",
      title: `การชำระค่าสมาชิกรอตรวจ ${operations.pendingPayments} รายการ`,
    },
    {
      action: "ดูหอพัก",
      count: subscriptions.expiringWithin30Days,
      detail: "แพ็กเกจที่หมดอายุภายใน 30 วัน ควรแจ้งเจ้าของหอล่วงหน้า",
      // เปิดตารางหอพักที่กรองเฉพาะหอชุดเดียวกับตัวเลขนี้
      href: "/super-admin/properties?status=expiring",
      label: "ใกล้หมด",
      title: `แพ็กเกจใกล้หมดอายุ ${subscriptions.expiringWithin30Days} หอ`,
    },
  ].filter((item) => item.count > 0);

  return <>
    <SuperAdminPageHeader description="ติดตามสุขภาพของแพลตฟอร์ม สมาชิก รายได้ และงานที่ต้องดำเนินการ" title="หน้าหลัก" />

    <div className="overview">
      <section aria-label="ตัวเลขแพลตฟอร์ม" className="overview-kpis">
        <article className="overview-kpi">
          <p>หอที่เปิดใช้งาน</p>
          <strong>{aggregation.properties.active.toLocaleString("th-TH")}</strong>
          <small>แอดมินประจำหอ {(aggregation.users.PROPERTY_ADMIN ?? 0).toLocaleString("th-TH")} คน</small>
        </article>
        <article className="overview-kpi">
          <p>รายได้ต่อเดือน (MRR)</p>
          {/* toLocaleString("th-TH") ใส่จุลภาคให้เอง อ่านเลขหลักล้านง่ายขึ้น */}
          <strong>฿{aggregation.revenue.mrr.toLocaleString("th-TH")}</strong>
          <small>จากสมาชิกที่ใช้งาน {subscriptions.active.toLocaleString("th-TH")} หอ</small>
        </article>
        <article className="overview-kpi">
          <p>การชำระรอตรวจ</p>
          <strong>{operations.pendingPayments.toLocaleString("th-TH")}</strong>
          <small>{operations.pendingPayments > 0 ? "ตรวจได้ที่หน้าการชำระสมาชิก" : "ไม่มีรายการค้าง"}</small>
        </article>
        <article className="overview-kpi">
          <p>หมดอายุใน 30 วัน</p>
          <strong>{subscriptions.expiringWithin30Days.toLocaleString("th-TH")}</strong>
          <small>ทดลองใช้อยู่ {subscriptions.trial.toLocaleString("th-TH")} หอ</small>
        </article>
      </section>

      <div className="overview-row">
        <section aria-labelledby="admin-today-title" className="overview-card today-card">
          <header className="overview-card-head">
            <div>
              <h2 id="admin-today-title">งานที่ต้องทำ</h2>
              <p>รายการที่ต้องเข้าไปจัดการในตอนนี้</p>
            </div>
            <small>{todos.length > 0 ? `${todos.reduce((total, item) => total + item.count, 0)} รายการรอดำเนินการ` : "ไม่มีรายการค้าง"}</small>
          </header>
          {todos.length === 0
            ? <p className="today-empty">ไม่มีรายการที่ต้องดำเนินการในตอนนี้</p>
            : <ul className="today-list">
              {todos.map((item) => <li className="today-row" key={item.href}>
                <span className="today-label" data-tone="pending">{item.label}</span>
                <div className="today-copy"><strong>{item.title}</strong><span>{item.detail}</span></div>
                <Link className="secondary-button" href={item.href}>{item.action}</Link>
              </li>)}
            </ul>}
        </section>

        <section aria-labelledby="admin-usage-title" className="overview-card">
          <h2 id="admin-usage-title">การใช้งานจริง</h2>
          <dl className="usage-facts">
            <div><dt>ห้องในระบบ</dt><dd>{usage.rooms.toLocaleString("th-TH")}</dd></div>
            <div><dt>ผู้เช่าที่ใช้งาน</dt><dd>{usage.activeTenants.toLocaleString("th-TH")}</dd></div>
            <div><dt>สมาชิกที่ใช้งาน</dt><dd>{subscriptions.active.toLocaleString("th-TH")}</dd></div>
            <div><dt>เรื่องแจ้งที่ยังเปิด</dt><dd>{operations.openTickets.toLocaleString("th-TH")}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  </>;
}
