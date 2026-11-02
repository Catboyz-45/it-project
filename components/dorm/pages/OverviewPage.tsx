"use client";
// หน้าแรกของเจ้าของหอ ตัวเลขสำคัญ เรื่องที่ต้องทำวันนี้ ความคืบหน้าของรอบบิล ผังห้อง และบิลที่ต้องตาม
// ทุกส่วนคำนวณจากข้อมูลที่หน้าโหลดมาแล้ว ไม่ยิงคำขอเพิ่ม

import { ArrowRight, Check } from "lucide-react";
import { currency, totalInvoice } from "@/lib/dorm-utils";
import type { Invoice, Room, Tenant } from "@/types/dorm";
import type { DashboardSummary, PageKey } from "@/types/navigation";
import type { OwnerDashboardAggregation } from "@/types/dashboard";
import { LEASE_EXPIRY_NOTICE_DAYS } from "@/lib/domain/lease-expiry";
import { formatThaiDate, formatThaiMonth } from "@/lib/thai-format";
import { alertTone } from "@/lib/domain/alert-urgency";
import { InitialAvatar } from "@/components/ui/InitialAvatar";

// เหลืออีกกี่วันถึงวันนั้น ติดลบคือเลยมาแล้ว
// 86_400_000 คือจำนวนมิลลิวินาทีในหนึ่งวัน ส่วน ceil ทำให้เศษของวันนับเป็นหนึ่งวันเต็ม
function calendarDaysUntil(value: string | Date) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

// คิดเป็นเปอร์เซ็นต์ กันหารด้วยศูนย์ตอนยังไม่มีห้อง และไม่ให้เกิน 100
function percent(value: number, max: number) {
  return max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
}

// urgent คือเรื่องที่เลยกำหนดแล้ว ป้ายเป็นสีแดง งานที่แค่รอทำเป็นสีเหลือง
// page เป็น null คือเปิดหน้าต่างแชทแทนการเปลี่ยนหน้า
type TodoItem = { key: string; label: string; title: string; detail: string; action: string; page: PageKey | null; urgent?: boolean };

// แพ็กเกจยังไม่มีหรือหมดอายุแล้วเป็นเรื่องด่วน เตือนล่วงหน้า 30 วันเป็นงานรอทำ
function subscriptionTodo(subscription: OwnerDashboardAggregation["subscription"]): TodoItem | null {
  if (!subscription) {
    return { key: "subscription", label: "แพ็กเกจ", title: "ยังไม่มีแพ็กเกจ", detail: "เลือกแพ็กเกจเพื่อเปิดใช้งานระบบ", action: "เลือกแพ็กเกจ", page: "subscription", urgent: true };
  }
  const remainingDays = calendarDaysUntil(subscription.expiresAt);
  if (remainingDays > 30) return null;
  const lapsed = remainingDays < 0;
  return {
    key: "subscription",
    label: lapsed ? "เลยกำหนด" : "แพ็กเกจ",
    title: lapsed ? "แพ็กเกจหมดอายุแล้ว" : `แพ็กเกจจะหมดอายุในอีก ${remainingDays} วัน`,
    detail: `หมดอายุ ${formatThaiDate(subscription.expiresAt)}`,
    action: "ต่ออายุ",
    page: "subscription",
    urgent: lapsed,
  };
}

// รวมเรื่องที่ต้องทำจากทุกส่วน บิลเลยกำหนดขึ้นก่อนเป็นรายห้อง ที่เหลือรวมเป็นก้อนตามประเภท
// โหมดอ่านอย่างเดียวบอกได้แค่ว่าเข้าไปดูอะไร ไม่ใช่ให้ไปทำอะไร
function buildTodos(aggregation: OwnerDashboardAggregation, unpaid: Invoice[], readOnly: boolean): TodoItem[] {
  const { finance, operations } = aggregation;
  const overdue = unpaid.filter((invoice) => invoice.status === "overdue");
  const todos: TodoItem[] = overdue.slice(0, 3).map((invoice) => ({
    key: `overdue-${invoice.id}`,
    label: "เลยกำหนด",
    title: `ห้อง ${invoice.roomId} · ${invoice.tenantName} ค้างบิล${formatThaiMonth(invoice.month)} ${currency.format(totalInvoice(invoice))}`,
    detail: "เลยวันครบกำหนดชำระแล้ว ติดตามหรือบันทึกรับเงินได้ในหน้าบิล",
    action: readOnly ? "ดูบิล" : "ติดตามบิล",
    page: "invoices",
    urgent: true,
  }));
  // ตัวเลขจากเซิร์ฟเวอร์นับบิลที่เลยวันครบกำหนดแล้วแม้สถานะยังไม่ถูกเปลี่ยนเป็นค้างชำระ
  // ใช้ตัวที่มากกว่า รายการตรงนี้จะได้ตรงกับการ์ดยอดเลยกำหนดด้านบนเสมอ
  const remaining = Math.max(finance.overdueInvoices, overdue.length) - todos.length;
  if (remaining > 0) {
    todos.push({
      key: "overdue-more",
      label: "เลยกำหนด",
      title: todos.length > 0 ? `บิลเลยกำหนดอีก ${remaining} บิล` : `บิลเลยกำหนด ${remaining} บิล`,
      detail: `รวมยอดเลยกำหนด ${currency.format(finance.overdueAmount)}`,
      action: readOnly ? "ดูบิล" : "ติดตามบิล",
      page: "invoices",
      urgent: true,
    });
  }
  const subscription = subscriptionTodo(aggregation.subscription);
  if (subscription?.urgent) todos.push(subscription);
  const waiting: Array<TodoItem & { count: number }> = [
    { key: "slips", count: finance.pendingPayments, label: "รอตรวจ", title: `สลิปรอตรวจ ${finance.pendingPayments} รายการ`, detail: "ตรวจยอดและหลักฐานก่อนยืนยันรับเงิน", action: readOnly ? "ดูสลิป" : "ตรวจสลิป", page: "invoices" },
    { key: "occupancies", count: aggregation.pendingOccupancies, label: "รออนุมัติ", title: `ผู้เช่ารออนุมัติ ${aggregation.pendingOccupancies} คน`, detail: "สมัครด้วยรหัสเชิญแล้ว รอเจ้าของหอยืนยันเข้าพัก", action: readOnly ? "ดูคำขอ" : "อนุมัติ", page: "tenants" },
    { key: "tickets", count: operations.openTickets, label: "แจ้งซ่อม", title: `แจ้งซ่อมและร้องเรียน ${operations.openTickets} เรื่องยังไม่ปิด`, detail: "อัปเดตสถานะให้ผู้เช่ารู้ความคืบหน้า", action: "ดูงานซ่อม", page: "complaints" },
    { key: "parcels", count: operations.waitingParcels, label: "พัสดุ", title: `พัสดุรอรับ ${operations.waitingParcels} ชิ้น`, detail: "ผู้เช่าเห็นในแอปแล้ว กดรับเมื่อผู้เช่ามารับ", action: "ดูพัสดุ", page: "parcels" },
    { key: "leases", count: operations.expiringLeases, label: "สัญญา", title: `สัญญาใกล้หมด ${operations.expiringLeases} ฉบับ`, detail: `หมดภายใน ${LEASE_EXPIRY_NOTICE_DAYS} วัน ต่อสัญญาหรือแจ้งผู้เช่าล่วงหน้า`, action: "ดูสัญญา", page: "contracts" },
    { key: "messages", count: operations.unreadTenantMessages, label: "ข้อความ", title: `ข้อความจากผู้เช่า ${operations.unreadTenantMessages} ข้อความ`, detail: "ยังไม่ได้เปิดอ่าน", action: readOnly ? "อ่าน" : "ตอบกลับ", page: null },
  ];
  todos.push(...waiting.filter((item) => item.count > 0));
  if (subscription && !subscription.urgent) todos.push(subscription);
  return todos;
}

function TodoRow({ item, onOpenChat, onOpenPage }: Readonly<{ item: TodoItem; onOpenChat: () => void; onOpenPage: (page: PageKey) => void }>) {
  const page = item.page;
  return <li className="today-row">
    <span className="today-label" data-tone={alertTone(item.urgent)}>{item.label}</span>
    <div className="today-copy">
      <strong>{item.title}</strong>
      <span>{item.detail}</span>
    </div>
    <button className="secondary-button" onClick={() => page ? onOpenPage(page) : onOpenChat()} type="button">{item.action}</button>
  </li>;
}

// ความคืบหน้าของรอบบิลล่าสุดเป็นขั้น ๆ เห็นว่าตอนนี้อยู่ขั้นไหนและเหลืออะไร
function BillingCycleCard({ cycleInvoices, cycleMonth, pendingPayments, onOpenPage, readOnly }: Readonly<{
  cycleInvoices: Invoice[];
  cycleMonth: string | null;
  pendingPayments: number;
  onOpenPage: (page: PageKey) => void;
  readOnly: boolean;
}>) {
  if (!cycleMonth || cycleInvoices.length === 0) {
    return <section aria-labelledby="cycle-title" className="overview-card cycle-card">
      <h2 id="cycle-title">ยังไม่มีรอบบิล</h2>
      <p className="overview-card-text">เริ่มรอบแรกด้วยการจดมิเตอร์น้ำและไฟของห้องที่มีผู้เช่า แล้วระบบจะสร้างบิลให้</p>
      {readOnly ? null : <button className="primary-button" onClick={() => onOpenPage("waterMeter")} type="button">จดมิเตอร์</button>}
    </section>;
  }
  const paid = cycleInvoices.filter((invoice) => invoice.status === "paid").length;
  const total = cycleInvoices.length;
  const unpaid = total - paid;
  const closed = unpaid === 0;
  return <section aria-labelledby="cycle-title" className="overview-card cycle-card">
    <div className="cycle-card-head">
      <h2 id="cycle-title">รอบบิล{formatThaiMonth(cycleMonth)}</h2>
      <span className="today-label" data-tone={closed ? "done" : "pending"}>{closed ? "เก็บครบแล้ว" : `ค้าง ${unpaid} บิล`}</span>
    </div>
    <ol className="cycle-steps">
      <li data-state="done">
        <span className="cycle-dot"><Check aria-hidden="true" size={14} strokeWidth={3} /></span>
        <div><strong>จดมิเตอร์และสร้างบิล</strong><span>{total} บิล ส่งเข้าแอปผู้เช่าแล้ว</span></div>
      </li>
      <li data-state={closed ? "done" : "active"}>
        <span className="cycle-dot">{closed ? <Check aria-hidden="true" size={14} strokeWidth={3} /> : null}</span>
        <div>
          <strong>เก็บเงิน</strong>
          <span>ชำระแล้ว {paid} จาก {total} ห้อง{pendingPayments > 0 ? ` · สลิปรอตรวจ ${pendingPayments}` : ""}</span>
          <span aria-hidden="true" className="overview-progress"><span style={{ width: `${Math.max(2, percent(paid, total))}%` }} /></span>
        </div>
      </li>
      <li data-state={closed ? "done" : "todo"}>
        <span className="cycle-dot">{closed ? <Check aria-hidden="true" size={14} strokeWidth={3} /> : null}</span>
        <div><strong>ปิดรอบ</strong><span>{closed ? "ทุกห้องชำระครบแล้ว" : "ปิดได้เมื่อทุกห้องชำระครบ"}</span></div>
      </li>
    </ol>
    <button className="secondary-button cycle-card-link" onClick={() => onOpenPage("invoices")} type="button">ดูบิลรอบนี้ <ArrowRight aria-hidden="true" size={16} /></button>
  </section>;
}

type MapRoom = { room: Room; label: string };

// จัดห้องเป็นอาคารและชั้น ห้องที่มีผู้เช่าแสดงชื่อผู้เช่าหลัก ห้องว่างแสดงค่าเช่า
function buildRoomMap(rooms: Room[], tenants: Tenant[], overdueRooms: Set<string>) {
  const tenantOf = new Map(tenants.filter((tenant) => tenant.role !== "CO_OCCUPANT").map((tenant) => [tenant.roomId, tenant]));
  const buildings = new Map<string, Map<number, MapRoom[]>>();
  for (const room of rooms) {
    const buildingName = room.buildingName ?? "อาคารหลัก";
    const floors = buildings.get(buildingName) ?? new Map<number, MapRoom[]>();
    const tenant = tenantOf.get(room.id);
    const others = (tenant?.occupantCount ?? 1) - 1;
    let label = `ว่าง · ${currency.format(room.rent)}`;
    if (room.status === "maintenance") label = "ปิดซ่อม";
    else if (room.status === "occupied") {
      const name = tenant ? `${tenant.nickname || tenant.name.split(" ")[0]}${others > 0 ? ` +${others}` : ""}` : "มีผู้เช่า";
      label = overdueRooms.has(room.id) ? `${name} · ค้าง` : name;
    }
    floors.set(room.floor, [...(floors.get(room.floor) ?? []), { room, label }]);
    buildings.set(buildingName, floors);
  }
  return Array.from(buildings.entries()).map(([name, floors]) => ({
    name,
    floors: Array.from(floors.entries()).sort(([left], [right]) => left - right),
  }));
}

const roomStatusLabel = { occupied: "มีผู้เช่า", available: "ว่าง", maintenance: "ปิดซ่อม" } as const;

function RoomMap({ rooms, tenants, overdueRooms, onOpenPage }: Readonly<{ rooms: Room[]; tenants: Tenant[]; overdueRooms: Set<string>; onOpenPage: (page: PageKey) => void }>) {
  const buildings = buildRoomMap(rooms, tenants, overdueRooms);
  return <section aria-labelledby="map-title" className="overview-card room-map">
    <div className="room-map-head">
      <h2 id="map-title">ผังห้อง</h2>
      <ul aria-label="ความหมายของสี" className="room-map-legend">
        <li><span className="status-dot" data-status="occupied" />มีผู้เช่า</li>
        <li><span className="status-dot" data-status="available" />ว่าง</li>
        <li><span className="status-dot" data-status="maintenance" />ปิดซ่อม</li>
      </ul>
    </div>
    {rooms.length === 0 ? <p className="overview-card-text">ยังไม่มีห้อง เพิ่มห้องได้ที่ตั้งค่าหอ</p> : null}
    {buildings.map((building) => <div className="room-map-building" key={building.name}>
      {building.floors.map(([floor, list]) => <div className="room-map-floor" key={floor}>
        <p>{buildings.length > 1 ? `${building.name} · ` : ""}ชั้น {floor}</p>
        <div className="room-map-grid">
          {list.map(({ room, label }) => <button
            aria-label={`ห้อง ${room.id} ${roomStatusLabel[room.status]} ${label}`}
            className="room-map-tile"
            data-status={room.status}
            key={room.id}
            onClick={() => onOpenPage("rooms")}
            type="button"
          >
            <span><strong>{room.id}</strong><span className="status-dot" data-status={room.status} /></span>
            <small>{label}</small>
          </button>)}
        </div>
      </div>)}
    </div>)}
  </section>;
}

const invoiceStatusLabel: Partial<Record<Invoice["status"], string>> = { overdue: "เลยกำหนด", pending: "รอชำระ" };

// บิลที่ยังไม่จ่ายทุกเดือน เลยกำหนดขึ้นก่อน บิลเดือนก่อนที่ค้างอยู่ต้องไม่หายไปจากหน้าแรก
function FollowUpBills({ unpaid, onOpenPage }: Readonly<{ unpaid: Invoice[]; onOpenPage: (page: PageKey) => void }>) {
  return <section aria-labelledby="follow-title" className="overview-card">
    <h2 id="follow-title">บิลที่ต้องตาม</h2>
    {unpaid.length === 0 ? <p className="overview-card-text">ไม่มีบิลค้าง ทุกห้องชำระครบแล้ว</p> : <ul className="follow-list">
      {unpaid.slice(0, 5).map((invoice) => <li key={invoice.id}>
        <button onClick={() => onOpenPage("invoices")} type="button">
          <InitialAvatar name={invoice.tenantName} />
          <span className="follow-copy">
            <strong>ห้อง {invoice.roomId} · {invoice.tenantName}</strong>
            <span>{formatThaiMonth(invoice.month)}</span>
          </span>
          <span className="follow-amount">
            <strong>{currency.format(totalInvoice(invoice))}</strong>
            <span className="today-label" data-tone={invoice.status === "overdue" ? "urgent" : "neutral"}>{invoiceStatusLabel[invoice.status]}</span>
          </span>
        </button>
      </li>)}
    </ul>}
    {unpaid.length > 5 ? <button className="secondary-button cycle-card-link" onClick={() => onOpenPage("invoices")} type="button">ดูบิลค้างทั้งหมด {unpaid.length} บิล</button> : null}
  </section>;
}

export function OverviewPage({
  aggregation,
  invoices,
  onOpenChat,
  readOnly = false,
  rooms,
  setActivePage,
  summary,
  tenants,
}: Readonly<{
  aggregation: OwnerDashboardAggregation;
  invoices: Invoice[];
  onOpenChat: () => void;
  readOnly?: boolean;
  rooms: Room[];
  setActivePage: (page: PageKey) => void;
  summary: DashboardSummary;
  tenants: Tenant[];
}>) {
  const { finance } = aggregation;
  const unpaid = invoices
    .filter((invoice) => invoice.status === "overdue" || invoice.status === "pending")
    .sort((left, right) => Number(right.status === "overdue") - Number(left.status === "overdue") || left.month.localeCompare(right.month));
  const overdueRooms = new Set(unpaid.filter((invoice) => invoice.status === "overdue").map((invoice) => invoice.roomId));
  const cycleInvoices = finance.cycleMonth
    ? invoices.filter((invoice) => invoice.month === finance.cycleMonth && invoice.status !== "draft" && invoice.status !== "cancelled")
    : [];
  const todos = buildTodos(aggregation, unpaid, readOnly);
  const availableRooms = rooms.filter((room) => room.status === "available").length;
  const maintenanceRooms = rooms.filter((room) => room.status === "maintenance").length;
  const collectedShare = percent(finance.collected, finance.billed);

  return <div className="overview">
    <section aria-label="ตัวเลขสำคัญ" className="overview-kpis">
      <article className="overview-kpi">
        <p>{finance.cycleMonth ? `ยอดบิลรอบ${formatThaiMonth(finance.cycleMonth)}` : "ยอดบิลรอบล่าสุด"}</p>
        <strong>{currency.format(finance.billed)}</strong>
        <small>{finance.cycleMonth ? `${cycleInvoices.length} บิล` : "ยังไม่มีรอบบิล"}</small>
      </article>
      <article className="overview-kpi">
        <p>เก็บได้แล้ว</p>
        <strong>{currency.format(finance.collected)}</strong>
        <span aria-hidden="true" className="overview-progress" data-tone="done"><span style={{ width: `${Math.max(2, collectedShare)}%` }} /></span>
        <small>{collectedShare}% ของรอบนี้{finance.pendingPayments > 0 ? ` · สลิปรอตรวจ ${finance.pendingPayments}` : ""}</small>
      </article>
      <article className="overview-kpi" data-tone={finance.overdueInvoices > 0 ? "urgent" : undefined}>
        <p>เลยกำหนดชำระ</p>
        <strong>{currency.format(finance.overdueAmount)}</strong>
        <small>{finance.overdueInvoices > 0 ? `${finance.overdueInvoices} บิล` : "ไม่มีบิลเลยกำหนด"}</small>
      </article>
      <article className="overview-kpi">
        <p>ห้องที่มีผู้เช่า</p>
        <strong>{summary.occupied}<span> / {rooms.length} ห้อง</span></strong>
        <span aria-hidden="true" className="overview-share">
          {summary.occupied > 0 ? <span data-status="occupied" style={{ flexGrow: summary.occupied }} /> : null}
          {availableRooms > 0 ? <span data-status="available" style={{ flexGrow: availableRooms }} /> : null}
          {maintenanceRooms > 0 ? <span data-status="maintenance" style={{ flexGrow: maintenanceRooms }} /> : null}
        </span>
        <small>ว่าง {availableRooms} · ปิดซ่อม {maintenanceRooms}</small>
      </article>
    </section>

    <div className="overview-row">
      <section aria-labelledby="today-title" className="overview-card today-card">
        <header className="overview-card-head">
          <div>
            <h2 id="today-title">{readOnly ? "รายการที่ควรตรวจสอบ" : "ต้องทำวันนี้"}</h2>
            <p>เรียงจากเรื่องที่ด่วนที่สุด</p>
          </div>
          <small>{todos.length > 0 ? `${todos.length} เรื่อง` : "ไม่มีเรื่องค้าง"}</small>
        </header>
        {todos.length === 0
          ? <p className="today-empty">ไม่มีเรื่องค้าง วันนี้เรียบร้อยดี</p>
          : <ul className="today-list">{todos.map((item) => <TodoRow item={item} key={item.key} onOpenChat={onOpenChat} onOpenPage={setActivePage} />)}</ul>}
      </section>
      <BillingCycleCard cycleInvoices={cycleInvoices} cycleMonth={finance.cycleMonth} onOpenPage={setActivePage} pendingPayments={finance.pendingPayments} readOnly={readOnly} />
    </div>

    <div className="overview-row">
      <RoomMap onOpenPage={setActivePage} overdueRooms={overdueRooms} rooms={rooms} tenants={tenants} />
      <FollowUpBills onOpenPage={setActivePage} unpaid={unpaid} />
    </div>
  </div>;
}
