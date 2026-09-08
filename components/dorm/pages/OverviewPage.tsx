"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Overview Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { AlertTriangle, ArrowRight, Building2, ChevronRight, CreditCard, FileClock, Gauge, Landmark, MessageSquare, PackageCheck, QrCode, ReceiptText, UserCheck, Wrench } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { currency, totalInvoice } from "@/lib/dorm-utils";
import type { Invoice, Room, Tenant } from "@/types/dorm";
import type { DashboardSummary, PageKey } from "@/types/navigation";
import type { OwnerDashboardAggregation } from "@/types/dashboard";
import { InvoiceList, Metric, PanelTitle } from "../shared";
import { LEASE_EXPIRY_NOTICE_DAYS, daysUntilLeaseExpiry } from "@/lib/domain/lease-expiry";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “calendar Days Until” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function calendarDaysUntil(value: string | Date) {
  const now = new Date();
  const target = new Date(value);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “percent” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - max: ค่า “max” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function percent(value: number, max: number) {
  return max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Animated Number” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { format = (value) => value.toLocaleString("th-TH"), label, : ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    const duration = 700;
    const startedAt = performance.now();
    let animationFrame = 0;

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update” โดยใช้ค่าที่รับเข้ามา
     * รับค่า:
     * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const update = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) animationFrame = window.requestAnimationFrame(update);
    };

    setDisplayValue(0);
    animationFrame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [value]);

  return <span aria-label={`${label} ${format(value)}`} className="animated-number"><span aria-hidden="true">{format(displayValue)}</span></span>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Overview Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { aggregation, invoices, onOpenChat, readOnly = false, rooms: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
  const latestMonth = invoices.at(-1)?.month;
  const currentInvoices = latestMonth ? invoices.filter((invoice) => invoice.month === latestMonth) : [];
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “overdue Invoices” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - invoice: ค่า “invoice” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const overdueInvoices = currentInvoices.filter((invoice) => invoice.status === "overdue");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “pending Invoices” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - invoice: ค่า “invoice” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const pendingInvoices = currentInvoices.filter((invoice) => invoice.status === "pending");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “near Contracts” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - tenant: ค่า “tenant” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const nearContracts = tenants.filter((tenant) => {
    if (!tenant.contractEnd) return false;
    const remainingDays = daysUntilLeaseExpiry(tenant.contractEnd);
    return remainingDays !== null && remainingDays >= 0 && remainingDays <= LEASE_EXPIRY_NOTICE_DAYS;
  });
  const availableRooms = rooms.filter((room) => room.status === "available").length;
  const maintenanceRooms = rooms.filter((room) => room.status === "maintenance").length;
  const revenueBars = Array.from(invoices.reduce((groups, invoice) => {
    const item = groups.get(invoice.month) ?? { label: invoice.month, rent: 0, water: 0, electric: 0, other: 0 };
    item.rent += invoice.rent;
    item.water += invoice.water;
    item.electric += invoice.electricity;
    item.other += invoice.service;
    groups.set(invoice.month, item);
    return groups;
  }, new Map<string, { label: string; rent: number; water: number; electric: number; other: number }>()).values()).slice(-12);
  const latestRevenue = revenueBars.at(-1);
  const latestRevenueTotal = latestRevenue
    ? latestRevenue.rent + latestRevenue.water + latestRevenue.electric + latestRevenue.other
    : 0;
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
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “pending Work Count” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - total: ค่า “total” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const pendingWorkCount = workItems.reduce((total, item) => total + item.count, 0);

  return (
    <>
      <section className="stats dashboard-metric-stagger" aria-label="ภาพรวมธุรกิจ">
        <Metric icon={<Landmark />} label="ยอดบิลรอบล่าสุด" value={<AnimatedNumber format={(value) => currency.format(value)} label="ยอดบิลรอบล่าสุด" value={summary.revenue + summary.pending} />} detail={latestMonth ?? "ยังไม่มีรอบบิล"} tone="indigo" />
        <Metric icon={<QrCode />} label="รายได้ที่รับแล้ว" value={<AnimatedNumber format={(value) => currency.format(value)} label="รายได้ที่รับแล้ว" value={summary.revenue} />} detail="ยอดที่ชำระเรียบร้อย" tone="green" />
        <Metric icon={<AlertTriangle />} label="ยอดค้างชำระ" value={<AnimatedNumber format={(value) => currency.format(value)} label="ยอดค้างชำระ" value={summary.pending} />} detail={`${summary.overdue} ห้องค้างชำระ`} tone="red" />
        <Metric icon={<Building2 />} label="ห้องที่มีผู้เช่า" value={<AnimatedNumber format={(value) => `${value.toLocaleString("th-TH")} ห้อง`} label="ห้องที่มีผู้เช่า" value={summary.occupied} />} detail={`${percent(summary.occupied, rooms.length)}% ของห้องทั้งหมด`} tone="blue" />
      </section>

      <section className="grid dashboard-panel-stagger">
        <article className="panel full">
          <PanelTitle
            title={readOnly ? "รายการที่ควรตรวจสอบ" : "งานที่ต้องทำ"}
            action={pendingWorkCount > 0 ? `${pendingWorkCount} รายการ${readOnly ? "สำหรับตรวจสอบ" : "รอดำเนินการ"}` : "ไม่มีรายการค้าง"}
          />
          {pendingWorkCount > 0 ? (
            <div className="work-item-grid">
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
        </article>

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
          {currentInvoices.length > 0 ? (
            <InvoiceList invoices={overdueInvoices.length > 0 ? overdueInvoices.slice(0, 3) : currentInvoices.slice(0, 3)} />
          ) : <div className="dashboard-empty-state">ยังไม่มีบิลที่ต้องติดตาม</div>}
        </article>

      </section>
    </>
  );
}
