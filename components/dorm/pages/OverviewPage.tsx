"use client";
// มีอนิเมชันตัวเลขที่ต้องใช้ timer และเช็คการตั้งค่าของเบราว์เซอร์

import { AlertTriangle, ArrowRight, Building2, ChevronRight, CreditCard, FileClock, Gauge, Landmark, ListChecks, MessageSquare, PackageCheck, QrCode, ReceiptText, UserCheck, Wrench } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { currency, totalInvoice } from "@/lib/dorm-utils";
import type { Invoice, Room, Tenant } from "@/types/dorm";
import type { DashboardSummary, PageKey } from "@/types/navigation";
import type { OwnerDashboardAggregation } from "@/types/dashboard";
import { AppSection } from "@/components/ui/AppSection";
import { InvoiceList, Metric, PanelTitle } from "../shared";
import { LEASE_EXPIRY_NOTICE_DAYS, daysUntilLeaseExpiry } from "@/lib/domain/lease-expiry";

// เหลืออีกกี่วันถึงวันนั้น ติดลบคือเลยมาแล้ว
// 86_400_000 คือจำนวนมิลลิวินาทีในหนึ่งวัน ส่วน ceil ทำให้เศษของวันนับเป็นหนึ่งวันเต็ม
function calendarDaysUntil(value: string | Date) {
  const now = new Date();
  const target = new Date(value);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

// คิดเป็นเปอร์เซ็นต์ กันหารด้วยศูนย์ตอนยังไม่มีห้อง และไม่ให้เกิน 100
function percent(value: number, max: number) {
  return max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
}

// ตัวเลขที่ไล่นับขึ้นตอนเปิดหน้า ทำให้ตัวเลขสำคัญสะดุดตากว่าโผล่มาเฉย ๆ
function AnimatedNumber({
  format = (value) => value.toLocaleString("th-TH"),
  label,
  value,
}: {
  format?: (value: number) => string;
  label: string;
  value: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // คนที่ตั้งเครื่องไว้ว่าไม่อยากเห็นภาพเคลื่อนไหว ก็แสดงค่าจริงไปเลยไม่ต้องไล่นับ
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    const duration = 700;
    const startedAt = performance.now();
    let animationFrame = 0;

    const update = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      // ยกกำลังสามทำให้เริ่มเร็วแล้วค่อย ๆ ช้าลงตอนใกล้ถึงค่าจริง ดูเป็นธรรมชาติกว่านับเท่ากันทุกช่วง
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) animationFrame = window.requestAnimationFrame(update);
    };

    setDisplayValue(0);
    animationFrame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [value]);

  // โปรแกรมอ่านหน้าจออ่านค่าจริงจาก label ส่วนตัวเลขที่ไล่นับซ่อนไว้ ไม่งั้นจะอ่านรัวทุกเฟรม
  return <span aria-label={`${label} ${format(value)}`} className="animated-number"><span aria-hidden="true">{format(displayValue)}</span></span>;
}

// หน้าแรกของเจ้าของหอ รวมตัวเลขสำคัญกับงานที่ต้องทำไว้ที่เดียว
export function OverviewPage({
  aggregation,
  invoices,
  onOpenChat,
  readOnly = false,
  rooms,
  setActivePage,
  summary,
  tenants,
}: {
  aggregation: OwnerDashboardAggregation;
  invoices: Invoice[];
  onOpenChat: () => void;
  readOnly?: boolean;
  rooms: Room[];
  setActivePage: (page: PageKey) => void;
  summary: DashboardSummary;
  tenants: Tenant[];
}) {
  // บิลเรียงตามเดือนมาแล้ว ตัวสุดท้ายจึงเป็นรอบล่าสุด
  const latestMonth = invoices.at(-1)?.month;
  const currentInvoices = latestMonth ? invoices.filter((invoice) => invoice.month === latestMonth) : [];
  const overdueInvoices = currentInvoices.filter((invoice) => invoice.status === "overdue");
  const pendingInvoices = currentInvoices.filter((invoice) => invoice.status === "pending");
  const nearContracts = tenants.filter((tenant) => {
    if (!tenant.contractEnd) return false;
    const remainingDays = daysUntilLeaseExpiry(tenant.contractEnd);
    return remainingDays !== null && remainingDays >= 0 && remainingDays <= LEASE_EXPIRY_NOTICE_DAYS;
  });
  const availableRooms = rooms.filter((room) => room.status === "available").length;
  const maintenanceRooms = rooms.filter((room) => room.status === "maintenance").length;
  // รวมยอดรายรับแยกตามเดือนและแยกตามประเภท ค่าเช่า ค่าน้ำ ค่าไฟ และอื่น ๆ
  const revenueBars = Array.from(invoices.reduce((groups, invoice) => {
    const item = groups.get(invoice.month) ?? { label: invoice.month, rent: 0, water: 0, electric: 0, other: 0 };
    item.rent += invoice.rent;
    item.water += invoice.water;
    item.electric += invoice.electricity;
    item.other += invoice.service;
    groups.set(invoice.month, item);
    return groups;
  // เก็บ 12 เดือนหลังสุดพอ ย้อนไกลกว่านั้นไปดูในหน้ารายงานแทน
  }, new Map<string, { label: string; rent: number; water: number; electric: number; other: number }>()).values()).slice(-12);
  const latestRevenue = revenueBars.at(-1);
  const latestRevenueTotal = latestRevenue
    ? latestRevenue.rent + latestRevenue.water + latestRevenue.electric + latestRevenue.other
    : 0;
  // จุดตัดของวงกลมสถานะห้อง ส่วนที่สองต้องบวกต่อจากส่วนแรก เพราะ conic-gradient นับจากจุดเริ่มเสมอ
  const occupiedEnd = percent(summary.occupied, rooms.length);
  const availableEnd = occupiedEnd + percent(availableRooms, rooms.length);
  const roomStatusItems = [
    { label: "มีผู้เช่า", value: summary.occupied, className: "badge badge-paid" },
    { label: "ว่าง", value: availableRooms, className: "badge badge-pending" },
    { label: "ซ่อม", value: maintenanceRooms, className: "badge badge-scheduled" },
  ];
  const urgentItems = [
    {
      action: readOnly ? "ดูรายการ" : "ตรวจบิล",
      detail: `${overdueInvoices.length} ห้องค้างชำระ รวม ${currency.format(overdueInvoices.reduce((sum, invoice) => sum + totalInvoice(invoice), 0))}`,
      onClick: () => setActivePage("invoices"),
      title: "บิลค้างชำระ",
    },
    {
      action: "ดูสัญญา",
      detail: `${nearContracts.length} สัญญาใกล้หมดภายใน ${LEASE_EXPIRY_NOTICE_DAYS} วัน`,
      onClick: () => setActivePage("contracts"),
      title: "สัญญาใกล้หมด",
    },
  ];
  // รวมงานค้างจากทุกส่วนไว้ในรายการเดียว จะได้เพิ่มหรือเรียงใหม่ได้โดยไม่ต้องแก้ JSX
  const workItems: Array<{
    count: number;
    detail: string;
    icon: ReactNode;
    page: PageKey | null;
    title: string;
  }> = [
    {
      count: aggregation.pendingOccupancies,
      detail: readOnly ? "ดูรายละเอียดคำขอเข้าพัก" : "ตรวจสอบและอนุมัติคำขอเข้าพัก",
      icon: <UserCheck size={20} />,
      page: "tenants",
      title: "ผู้เช่ารออนุมัติ",
    },
    {
      count: aggregation.finance.pendingPayments,
      detail: readOnly ? "ดูยอดและหลักฐานการชำระ" : "ตรวจยอดและหลักฐานการชำระ",
      icon: <ReceiptText size={20} />,
      page: "invoices",
      title: "สลิปรอตรวจสอบ",
    },
    {
      count: aggregation.finance.overdueInvoices,
      detail: readOnly ? "ดูยอดค้างชำระและค่าปรับล่าช้า" : "ติดตามยอดค้างชำระและค่าปรับล่าช้า",
      icon: <AlertTriangle size={20} />,
      page: "invoices",
      title: "บิลค้างชำระ",
    },
    {
      count: aggregation.operations.openTickets,
      detail: "งานซ่อมและข้อร้องเรียนที่ยังไม่เสร็จ",
      icon: <Wrench size={20} />,
      page: "complaints",
      title: "เรื่องที่กำลังดำเนินการ",
    },
    {
      count: aggregation.operations.waitingParcels,
      detail: "พัสดุที่ยังรอผู้เช่ามารับ",
      icon: <PackageCheck size={20} />,
      page: "parcels",
      title: "พัสดุรอรับ",
    },
    {
      count: aggregation.operations.expiringLeases,
      detail: `สัญญาที่หมดอายุภายใน ${LEASE_EXPIRY_NOTICE_DAYS} วัน`,
      icon: <FileClock size={20} />,
      page: "contracts",
      title: "สัญญาใกล้หมด",
    },
    {
      count: aggregation.operations.unreadTenantMessages,
      detail: readOnly ? "เปิดอ่านประวัติข้อความจากผู้เช่า" : "เปิดกล่องข้อความเพื่อตอบกลับผู้เช่า",
      icon: <MessageSquare size={20} />,
      page: null,
      title: "ข้อความที่ยังไม่ได้อ่าน",
    },
    {
      // เตือนล่วงหน้า 30 วัน และเตือนตลอดถ้ายังไม่มีแพ็กเกจเลย นับเป็น 1 เพราะเป็นเรื่องเดียว
      count: !aggregation.subscription
        || calendarDaysUntil(aggregation.subscription.expiresAt) <= 30
        ? 1
        : 0,
      detail: aggregation.subscription
        ? `แพ็กเกจหมดอายุ ${new Date(aggregation.subscription.expiresAt).toLocaleDateString("th-TH")}`
        : "เลือกแพ็กเกจเพื่อเปิดใช้งานระบบ",
      icon: <CreditCard size={20} />,
      page: "subscription",
      title: aggregation.subscription && calendarDaysUntil(aggregation.subscription.expiresAt) < 0
        ? "แพ็กเกจหมดอายุแล้ว"
        : "แพ็กเกจใกล้หมดอายุ",
    },
  ];
  // ไม่มีงานค้างเลยก็แสดงข้อความว่าง แทนที่จะโชว์กล่องเปล่า
  const pendingWorkCount = workItems.reduce((total, item) => total + item.count, 0);

  return (
    <>
      <AppSection description="ยอดบิล รายได้ และห้องที่มีผู้เช่าของรอบล่าสุด" icon={<Gauge />} title="ภาพรวมธุรกิจ">
      <section className="stats dashboard-metric-stagger" aria-label="ภาพรวมธุรกิจ">
        <Metric icon={<Landmark />} label="ยอดบิลรอบล่าสุด" value={<AnimatedNumber format={(value) => currency.format(value)} label="ยอดบิลรอบล่าสุด" value={summary.revenue + summary.pending} />} detail={latestMonth ?? "ยังไม่มีรอบบิล"} tone="indigo" />
        <Metric icon={<QrCode />} label="รายได้ที่รับแล้ว" value={<AnimatedNumber format={(value) => currency.format(value)} label="รายได้ที่รับแล้ว" value={summary.revenue} />} detail="ยอดที่ชำระเรียบร้อย" tone="green" />
        <Metric icon={<AlertTriangle />} label="ยอดค้างชำระ" value={<AnimatedNumber format={(value) => currency.format(value)} label="ยอดค้างชำระ" value={summary.pending} />} detail={`${summary.overdue} ห้องค้างชำระ`} tone="red" />
        <Metric icon={<Building2 />} label="ห้องที่มีผู้เช่า" value={<AnimatedNumber format={(value) => `${value.toLocaleString("th-TH")} ห้อง`} label="ห้องที่มีผู้เช่า" value={summary.occupied} />} detail={`${percent(summary.occupied, rooms.length)}% ของห้องทั้งหมด`} tone="blue" />
      </section>
      </AppSection>

      <AppSection
        aside={pendingWorkCount > 0 ? `${pendingWorkCount} รายการ${readOnly ? "สำหรับตรวจสอบ" : "รอดำเนินการ"}` : "ไม่มีรายการค้าง"}
        description="รายการที่ต้องเข้าไปจัดการในตอนนี้"
        icon={<ListChecks />}
        title={readOnly ? "รายการที่ควรตรวจสอบ" : "งานที่ต้องทำ"}
      >
          {pendingWorkCount > 0 ? (
            <div className="work-item-grid">
              {/* ซ่อนรายการที่ไม่มีอะไรค้าง จะได้เห็นเฉพาะเรื่องที่ต้องทำจริง */}
              {workItems.filter((item) => item.count > 0).map((item) => {
                const content = <>
                  <span className="work-item-icon">{item.icon}</span>
                  <span className="work-item-copy">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <span className="work-item-count">{item.count > 99 ? "99+" : item.count}</span>
                  <ChevronRight aria-hidden="true" className="work-item-arrow" size={20} />
                </>;
                // ส่วนใหญ่กดแล้วไปหน้าอื่น ยกเว้นข้อความที่เปิดหน้าต่างแชทแทน
                return item.page ? (
                  <button aria-label={`${item.title} ${item.count} รายการ เปิดหน้า${item.title}`} className="interactive-card" key={item.title} onClick={() => setActivePage(item.page!)} type="button">{content}<span className="sr-only">เปิดหน้า{item.title}</span></button>
                ) : (
                  <button aria-label={`${item.title} ${item.count} รายการ เปิดหน้าต่างข้อความ`} className="interactive-card" key={item.title} onClick={onOpenChat} type="button">{content}<span className="sr-only">เปิดหน้าต่างข้อความ</span></button>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty-state">ไม่มีรายการเร่งด่วนที่ต้องดำเนินการในขณะนี้</div>
          )}
      </AppSection>

      <section className="grid dashboard-panel-stagger">
        <article className="panel wide revenue-summary-panel">
          <PanelTitle title="สรุปรายรับรอบล่าสุด" action={latestRevenue?.label ?? "ยังไม่มีรอบบิล"} />
          {latestRevenue ? (
            <section className="revenue-summary" aria-label={`สรุปรายรับรอบ ${latestRevenue.label}`}>
              <div className="revenue-summary-total">
                <span>ยอดรวมรอบนี้</span>
                <strong>{currency.format(latestRevenueTotal)}</strong>
              </div>
              <dl className="revenue-breakdown">
                <div className="rent"><dt>ค่าเช่า</dt><dd>{currency.format(latestRevenue.rent)}</dd></div>
                <div className="water"><dt>ค่าน้ำ</dt><dd>{currency.format(latestRevenue.water)}</dd></div>
                <div className="electric"><dt>ค่าไฟ</dt><dd>{currency.format(latestRevenue.electric)}</dd></div>
                <div className="other"><dt>อื่น ๆ</dt><dd>{currency.format(latestRevenue.other)}</dd></div>
              </dl>
            </section>
          ) : <div className="dashboard-empty-state">ยังไม่มีข้อมูลบิลสำหรับสรุปรายรับ</div>}
        </article>

        <article className="panel">
          <PanelTitle title="สถานะห้อง" action={`${rooms.length} ห้อง`} />
          <div
            className="room-status-donut"
            aria-label={`มีผู้เช่า ${summary.occupied} ห้อง ห้องว่าง ${availableRooms} ห้อง ซ่อมบำรุง ${maintenanceRooms} ห้อง`}
            // วาดวงกลมด้วย conic-gradient ของ CSS เบากว่าดึงไลบรารีกราฟมาทั้งตัวเพื่อวงเดียว
            style={{ background: rooms.length > 0 ? `conic-gradient(#35ed7e 0 ${occupiedEnd}%, #fbbf24 ${occupiedEnd}% ${availableEnd}%, #ec48bd ${availableEnd}% 100%)` : "#dedfe4" }}
          />
          <div className="room-status-overview">
            {roomStatusItems.map((item) => (
              <div key={item.label}>
                <span className={item.className}>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{percent(item.value, rooms.length)}%</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel wide">
          <PanelTitle title="เรื่องสำคัญที่ต้องรู้" action="เรียงตามความเร่งด่วน" />
          <div className="priority-list">
            {urgentItems.map((item) => (
              <button aria-label={`${item.title}: ${item.detail} กดเพื่อ${item.action}`} className="interactive-card" key={item.title} onClick={item.onClick} type="button">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
                <small>{item.action}<ArrowRight aria-hidden="true" size={15} /></small>
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <PanelTitle title={readOnly ? "ข้อมูลรอบบิล" : "งานรอบบิล"} action={readOnly ? "เปิดดูข้อมูลเดิม" : "งานที่ต้องทำประจำ"} />
          <div className="quick-actions dashboard-actions">
            <button onClick={() => setActivePage("waterMeter")} type="button"><Gauge aria-hidden="true" size={20} /><strong>{readOnly ? "ดูมิเตอร์" : "จดมิเตอร์"}</strong><small>เปิดหน้ามิเตอร์ <ChevronRight aria-hidden="true" size={14} /></small></button>
            <button onClick={() => setActivePage("invoices")} type="button"><QrCode aria-hidden="true" size={20} /><strong>{readOnly ? "ดูบิล" : "ตรวจบิล"}</strong><small>เปิดหน้าบิล <ChevronRight aria-hidden="true" size={14} /></small></button>
          </div>
          <div className="mini-row">
            <strong>รอชำระ {pendingInvoices.length} ห้อง</strong>
            <span>{readOnly ? "ดูยอดและประวัติเดิมได้ในหน้าบิล" : "ตรวจหลักฐานการโอนก่อนอนุมัติการชำระในหน้าบิล"}</span>
          </div>
        </article>

        <article className="panel full">
          <PanelTitle title="บิลที่ต้องตาม" action={`${overdueInvoices.length} รายการค้างชำระ`} />
          {/* โชว์บิลค้างก่อนถ้ามี ไม่มีค้างก็โชว์บิลรอบล่าสุดแทน เอาแค่ 3 รายการพอ */}
          {currentInvoices.length > 0 ? (
            <InvoiceList invoices={overdueInvoices.length > 0 ? overdueInvoices.slice(0, 3) : currentInvoices.slice(0, 3)} />
          ) : <div className="dashboard-empty-state">ยังไม่มีบิลที่ต้องติดตาม</div>}
        </article>

      </section>
    </>
  );
}
