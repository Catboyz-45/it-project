// หน้าผังห้อง ใช้ state เก็บชั้น สถานะ และรูปแบบการแสดงผลที่เลือก
// กดห้องแล้วแสดงรายละเอียดในแผงด้านขวา ส่วนการแก้ไขเปิดกล่องจัดการห้องจากแผงนั้น
import { useMemo, useRef, useState } from "react";
import { Grid2X2, List } from "lucide-react";
import { currency, getStatusClass, statusText, totalInvoice } from "@/lib/dorm-utils";
import type { Invoice, Room, Tenant } from "@/types/dorm";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { SummaryCard, SummaryCards } from "@/components/ui/SummaryCards";
import { InitialAvatar } from "@/components/ui/InitialAvatar";
import { roomTypeLabel } from "@/lib/ui-labels";
import { formatThaiDate, formatThaiMonth, formatThaiPhone } from "@/lib/thai-format";

type StatusFilter = "all" | Room["status"];

// การ์ดสรุปจำนวนห้องด้านบนใช้กรองสถานะไปด้วย ห้องทั้งหมดใช้ล้างตัวกรอง
const statusFilters: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "ห้องทั้งหมด" },
  { key: "occupied", label: "มีผู้เช่า" },
  { key: "available", label: "ว่าง" },
  { key: "maintenance", label: "ปิดซ่อม" },
];

// ดูห้องได้สองแบบ การ์ดแบ่งตามอาคารกับชั้น หรือตารางเรียงยาว
export function RoomsPage({
  invoices,
  rooms,
  onEditRoom,
  readOnly = false,
  selectedRoom,
  setSelectedRoomId,
  tenants,
}: Readonly<{
  invoices: Invoice[];
  rooms: Room[];
  onEditRoom: () => void;
  readOnly?: boolean;
  selectedRoom?: Room;
  setSelectedRoomId: (roomId: string) => void;
  tenants: Tenant[];
}>) {
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const detailRef = useRef<HTMLElement>(null);
  // Set ตัดชั้นที่ซ้ำกันออก เหลือรายชื่อชั้นที่มีห้องอยู่จริง
  const floors = [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b);
  const floorTabs: Array<number | "all"> = ["all", ...floors];
  const viewTabs = ["card", "table"] as const;
  // แถบเลือกชั้นกับแถบเลือกมุมมองเป็น tablist ต้องเลื่อนด้วยลูกศรได้ตามมาตรฐาน ARIA
  const handleFloorKeyDown = useTablistKeyboard(floorTabs, setSelectedFloor);
  const handleViewKeyDown = useTablistKeyboard(viewTabs, setViewMode);
  // เรียงตามชั้นก่อน แล้วค่อยเรียงเลขห้อง
  // numeric: true ทำให้ห้อง 10 อยู่หลังห้อง 9 ไม่ใช่หลังห้อง 1 แบบเรียงตามตัวอักษร
  const visibleRooms = rooms
    .filter((room) => selectedFloor === "all" || room.floor === selectedFloor)
    .filter((room) => statusFilter === "all" || room.status === statusFilter)
    .sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id, "th", { numeric: true }));
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleRooms);
  const statusCounts: Record<StatusFilter, number> = {
    all: rooms.length,
    occupied: rooms.filter((room) => room.status === "occupied").length,
    available: rooms.filter((room) => room.status === "available").length,
    maintenance: rooms.filter((room) => room.status === "maintenance").length,
  };
  // ทำเป็น Set เพราะข้างล่างต้องเช็คทีละห้องหลายรอบ Set เช็คได้เร็วกว่าไล่หาในอาเรย์
  const overdueRooms = new Set(
    invoices.filter((invoice) => invoice.status === "overdue").map((invoice) => invoice.roomId),
  );
  // ผู้เช่าหลักของแต่ละห้อง ใช้แสดงชื่อบนการ์ดและในตาราง
  const primaryTenantOf = new Map(tenants.filter((tenant) => tenant.role !== "CO_OCCUPANT").map((tenant) => [tenant.roomId, tenant]));
  // จัดกลุ่มไว้ใช้กับมุมมองการ์ด มุมมองตารางใช้รายการเรียงยาวตามปกติ
  const roomGroups = useMemo(() => groupRoomsByBuildingAndFloor(visibleRooms), [visibleRooms]);

  // เลือกห้องแล้วแสดงรายละเอียด จอแคบแผงอยู่ใต้ผัง จึงเลื่อนลงไปให้เห็นทันที
  const selectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const floorLabel = selectedFloor === "all" ? "ทุกชั้น" : `ชั้น ${selectedFloor}`;
  const resultsLabel = `ผลการแสดงห้อง ${floorLabel} รูปแบบ${viewMode === "card" ? "การ์ด" : "ตาราง"}`;

  return (
    <section className="figma-rooms-page rooms-page-content">
      {readOnly ? <ReadOnlyNotice>เลือกห้องเพื่อดูรายละเอียดได้ และยังกรองชั้นหรือเปลี่ยนรูปแบบการแสดงผลได้ แต่ไม่สามารถแก้ไขข้อมูลห้อง</ReadOnlyNotice> : null}
      <SummaryCards label="กรองตามสถานะห้อง">
        {statusFilters.map((filter) => <SummaryCard
          dot={filter.key === "all" ? undefined : filter.key}
          key={filter.key}
          label={filter.label}
          onSelect={() => setStatusFilter(filter.key)}
          pressed={statusFilter === filter.key}
          unit="ห้อง"
          value={statusCounts[filter.key]}
        />)}
      </SummaryCards>
      <div className="rooms-view-toolbar">
        <div className="figma-inline-tabs floor-tabs" aria-label="เลือกชั้น" onKeyDown={handleFloorKeyDown} role="tablist" tabIndex={-1}>
          <button aria-controls="rooms-results-panel" aria-selected={selectedFloor === "all"} className={selectedFloor === "all" ? "active" : ""} id="rooms-floor-tab-all" onClick={() => setSelectedFloor("all")} role="tab" tabIndex={selectedFloor === "all" ? 0 : -1} type="button">ทุกชั้น</button>
          {floors.map((floor) => <button aria-controls="rooms-results-panel" aria-selected={selectedFloor === floor} className={selectedFloor === floor ? "active" : ""} id={`rooms-floor-tab-${floor}`} key={floor} onClick={() => setSelectedFloor(floor)} role="tab" tabIndex={selectedFloor === floor ? 0 : -1} type="button">ชั้น {floor}</button>)}
        </div>
        <div className="rooms-view-toggle" aria-label="รูปแบบการแสดงผังห้อง" onKeyDown={handleViewKeyDown} role="tablist" tabIndex={-1}>
          <button aria-controls="rooms-results-panel" aria-selected={viewMode === "card"} className={viewMode === "card" ? "active" : ""} id="rooms-view-tab-card" onClick={() => setViewMode("card")} role="tab" tabIndex={viewMode === "card" ? 0 : -1} type="button"><Grid2X2 aria-hidden="true" size={17} /> การ์ด</button>
          <button aria-controls="rooms-results-panel" aria-selected={viewMode === "table"} className={viewMode === "table" ? "active" : ""} id="rooms-view-tab-table" onClick={() => setViewMode("table")} role="tab" tabIndex={viewMode === "table" ? 0 : -1} type="button"><List aria-hidden="true" size={18} /> ตาราง</button>
        </div>
      </div>
      <div className="rooms-layout">
        {/* key เปลี่ยนตามชั้นและมุมมอง เพื่อบังคับให้ React วาดใหม่ทั้งก้อน อนิเมชันเปลี่ยนหน้าจะได้เล่น */}
        <div aria-label={resultsLabel} className="view-transition rooms-results" id="rooms-results-panel" key={`${selectedFloor}-${viewMode}`} role="tabpanel" tabIndex={0}>
          <RoomsResults
            hasFilter={selectedFloor !== "all" || statusFilter !== "all"}
            onSelectRoom={selectRoom}
            overdueRooms={overdueRooms}
            page={page}
            pageItems={pageItems}
            primaryTenantOf={primaryTenantOf}
            roomGroups={roomGroups}
            selectedRoomId={selectedRoom?.id}
            setPage={setPage}
            totalPages={totalPages}
            viewMode={viewMode}
            visibleRooms={visibleRooms}
          />
        </div>
        <RoomDetailPanel
          invoices={invoices}
          isOverdue={selectedRoom ? overdueRooms.has(selectedRoom.id) : false}
          onEditRoom={onEditRoom}
          panelRef={detailRef}
          readOnly={readOnly}
          room={selectedRoom}
          tenants={tenants}
        />
      </div>
    </section>
  );
}

// โครงสร้างสองชั้น อาคารข้างในมีชั้น ชั้นข้างในมีห้อง
type RoomBuildingGroup = {
  name: string;
  roomCount: number;
  floors: Array<{ number: number; rooms: Room[] }>;
};

// จัดห้องเข้ากลุ่มตามอาคารและชั้น เพื่อให้มุมมองการ์ดแสดงเป็นผังอาคารได้
function groupRoomsByBuildingAndFloor(rooms: Room[]): RoomBuildingGroup[] {
  // Map ซ้อน Map เพราะต้องจัดกลุ่มสองชั้น และ Map รักษาลำดับที่ใส่เข้าไป
  const buildings = new Map<string, Map<number, Room[]>>();
  rooms.forEach((room) => {
    // หอที่มีตึกเดียวมักไม่ได้ตั้งชื่ออาคารไว้ จึงต้องมีชื่อสำรองให้
    const buildingName = room.buildingName?.trim() || "อาคารหลัก";
    const floors = buildings.get(buildingName) ?? new Map<number, Room[]>();
    const floorRooms = floors.get(room.floor) ?? [];
    floorRooms.push(room);
    floors.set(room.floor, floorRooms);
    buildings.set(buildingName, floors);
  });

  return Array.from(buildings, ([name, floorMap]) => {
    // เรียงห้องในแต่ละชั้น แล้วเรียงชั้นอีกที ให้ผังออกมาตรงกับของจริง
    const groupedFloors = Array.from(floorMap, ([number, floorRooms]) => ({
      number,
      rooms: floorRooms.toSorted((a, b) => a.id.localeCompare(b.id, "th", { numeric: true })),
    })).sort((a, b) => a.number - b.number);
    return { name, roomCount: groupedFloors.reduce((total, floor) => total + floor.rooms.length, 0), floors: groupedFloors };
  }).sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
}

type RoomGroups = ReturnType<typeof groupRoomsByBuildingAndFloor>;

// ว่างเพราะกรองแล้วไม่เจอ กับว่างเพราะยังไม่มีห้องเลย ต้องบอกคนละแบบ
function RoomsResults({ hasFilter, onSelectRoom, overdueRooms, page, pageItems, primaryTenantOf, roomGroups, selectedRoomId, setPage, totalPages, viewMode, visibleRooms }: Readonly<{
  hasFilter: boolean;
  onSelectRoom: (roomId: string) => void;
  overdueRooms: Set<string>;
  page: number;
  pageItems: Room[];
  primaryTenantOf: Map<string, Tenant>;
  roomGroups: RoomGroups;
  selectedRoomId?: string;
  setPage: (page: number) => void;
  totalPages: number;
  viewMode: "card" | "table";
  visibleRooms: Room[];
}>) {
  if (visibleRooms.length === 0 && hasFilter) {
    return <SearchEmptyState description="ลองเลือกชั้นหรือสถานะอื่น หรือกลับไปดูทั้งหมด" title="ไม่พบห้องที่ตรงกับตัวกรอง" />;
  }
  if (visibleRooms.length === 0) return <div className="empty-state">ยังไม่มีห้องพัก</div>;
  if (viewMode === "card") {
    return <RoomPlanView onSelectRoom={onSelectRoom} overdueRooms={overdueRooms} primaryTenantOf={primaryTenantOf} roomGroups={roomGroups} selectedRoomId={selectedRoomId} />;
  }
  return <RoomTableView onSelectRoom={onSelectRoom} page={page} pageItems={pageItems} primaryTenantOf={primaryTenantOf} selectedRoomId={selectedRoomId} setPage={setPage} totalItems={visibleRooms.length} totalPages={totalPages} />;
}

// มุมมองการ์ด จัดกลุ่มตามอาคารและชั้นให้เหมือนผังห้องจริง
function RoomPlanView({ onSelectRoom, overdueRooms, primaryTenantOf, roomGroups, selectedRoomId }: Readonly<{
  onSelectRoom: (roomId: string) => void;
  overdueRooms: Set<string>;
  primaryTenantOf: Map<string, Tenant>;
  roomGroups: RoomGroups;
  selectedRoomId?: string;
}>) {
  return <div className="room-building-stack">
    {roomGroups.map((building) => <section className="room-building-section" key={building.name}>
      {roomGroups.length > 1 ? <h2 className="room-building-title">{building.name} <small>{building.roomCount.toLocaleString("th-TH")} ห้อง</small></h2> : null}
      {building.floors.map((floor) => <section className="room-floor-group" key={`${building.name}-${floor.number}`}>
        <header><strong>ชั้น {floor.number}</strong><small>มีผู้เช่า {floor.rooms.filter((room) => room.status === "occupied").length} จาก {floor.rooms.length} ห้อง</small></header>
        <div className="room-plan-grid">
          {floor.rooms.map((room) => <RoomPlanCard
            isOverdue={overdueRooms.has(room.id)}
            isSelected={selectedRoomId === room.id}
            key={room.databaseId ?? `${building.name}-${room.floor}-${room.id}`}
            onSelect={onSelectRoom}
            room={room}
            tenant={primaryTenantOf.get(room.id)}
          />)}
        </div>
      </section>)}
    </section>)}
  </div>;
}

const roomFootText: Record<Room["status"], string> = {
  occupied: "มีผู้เช่า",
  available: "พร้อมเปิดเช่า",
  maintenance: "กำลังซ่อมบำรุง",
};

// ใส่เลขห้องกับสถานะใน label เพราะทุกการ์ดหน้าตาเหมือนกันหมด
function RoomPlanCard({ isOverdue, isSelected, onSelect, room, tenant }: Readonly<{
  isOverdue: boolean;
  isSelected: boolean;
  onSelect: (roomId: string) => void;
  room: Room;
  tenant?: Tenant;
}>) {
  const others = (tenant?.occupantCount ?? 1) - 1;
  return <button
    aria-label={`ดูรายละเอียดห้อง ${room.id} สถานะ${statusText[room.status]}`}
    aria-pressed={isSelected}
    className="room-plan-card"
    data-status={room.status}
    onClick={() => onSelect(room.id)}
    type="button"
  >
    <span className="room-plan-card-head">
      <strong>{room.id}</strong>
      <span className="room-status-label"><span className="status-dot" data-status={room.status} />{statusText[room.status]}</span>
    </span>
    <span className="room-plan-card-detail">{roomTypeLabel(room.roomType)} · {currency.format(room.rent)}/เดือน</span>
    <span className="room-plan-card-foot">
      {room.status === "occupied" && tenant
        ? <span className="room-plan-tenant"><InitialAvatar name={tenant.name} size="sm" />{tenant.name}{others > 0 ? ` +${others}` : ""}</span>
        : <span>{roomFootText[room.status]}</span>}
      {isOverdue ? <span className="today-label" data-tone="urgent">ค้างชำระ</span> : null}
    </span>
  </button>;
}

// มุมมองตาราง ข้อมูลห้องเรียงตามอาคาร ชั้น และเลขห้อง
function RoomTableView({ onSelectRoom, page, pageItems, primaryTenantOf, selectedRoomId, setPage, totalItems, totalPages }: Readonly<{
  onSelectRoom: (roomId: string) => void;
  page: number;
  pageItems: Room[];
  primaryTenantOf: Map<string, Tenant>;
  selectedRoomId?: string;
  setPage: (page: number) => void;
  totalItems: number;
  totalPages: number;
}>) {
  return <article className="figma-table-card">
    <div className="figma-table-wrap">
      <table className="figma-table rooms-data-table">
        <thead><tr><th scope="col">ห้อง</th><th scope="col">อาคาร</th><th scope="col">ชั้น</th><th scope="col">ประเภท</th><th scope="col">ค่าเช่า</th><th scope="col">ผู้เช่า</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr></thead>
        <tbody>{pageItems.map((room) => <tr className={selectedRoomId === room.id ? "selected" : ""} key={room.databaseId ?? `${room.buildingName}-${room.floor}-${room.id}`}>
          <td><strong>ห้อง {room.id}</strong></td>
          <td>{room.buildingName || "อาคารหลัก"}</td>
          <td>ชั้น {room.floor}</td>
          <td>{roomTypeLabel(room.roomType)}</td>
          <td><strong>{currency.format(room.rent)}</strong></td>
          <td>{room.status === "occupied" ? primaryTenantOf.get(room.id)?.name ?? "มีผู้เช่า" : "-"}</td>
          <td><span className={getStatusClass(room.status)}>{statusText[room.status]}</span></td>
          <td><button className="secondary-button" onClick={() => onSelectRoom(room.id)} type="button">ดูข้อมูล</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    <TablePagination page={page} setPage={setPage} totalItems={totalItems} totalPages={totalPages} />
  </article>;
}

const roleLabel = { PRIMARY: "ผู้เช่าหลัก", CO_OCCUPANT: "ผู้พักร่วม" } as const;

// แผงรายละเอียดของห้องที่เลือก ผู้พัก สัญญา บิลล่าสุด และมิเตอร์ล่าสุด
function RoomDetailPanel({ invoices, isOverdue, onEditRoom, panelRef, readOnly, room, tenants }: Readonly<{
  invoices: Invoice[];
  isOverdue: boolean;
  onEditRoom: () => void;
  panelRef: React.RefObject<HTMLElement | null>;
  readOnly: boolean;
  room?: Room;
  tenants: Tenant[];
}>) {
  if (!room) {
    return <aside aria-label="รายละเอียดห้อง" className="room-detail" ref={panelRef}>
      <p className="room-detail-empty">เลือกห้องจากผังเพื่อดูผู้เช่า บิล และมิเตอร์ล่าสุด</p>
    </aside>;
  }
  const people = tenants.filter((tenant) => tenant.roomId === room.id)
    .sort((left, right) => Number(right.role !== "CO_OCCUPANT") - Number(left.role !== "CO_OCCUPANT"));
  const primary = people.find((tenant) => tenant.role !== "CO_OCCUPANT");
  const latestInvoice = invoices.filter((invoice) => invoice.roomId === room.id && invoice.status !== "draft" && invoice.status !== "cancelled")
    .toSorted((left, right) => right.month.localeCompare(left.month))[0];
  const location = `${room.buildingName?.trim() || "อาคารหลัก"} ชั้น ${room.floor}`;
  return <aside aria-labelledby="room-detail-title" className="room-detail" ref={panelRef}>
    <header className="room-detail-head">
      <div>
        <h2 id="room-detail-title">ห้อง {room.id}</h2>
        <p>{roomTypeLabel(room.roomType)} · {currency.format(room.rent)}/เดือน · {location}</p>
      </div>
      <span className="room-status-label"><span className="status-dot" data-status={room.status} />{statusText[room.status]}</span>
    </header>
    {room.status === "occupied" ? <>
      <div className="room-detail-section">
        <p className="room-detail-caption">ผู้พักในห้อง</p>
        {people.length === 0 ? <p className="room-detail-muted">ยังไม่มีข้อมูลผู้เช่า</p> : <ul className="room-detail-people">
          {people.map((tenant) => <li key={tenant.id}>
            <InitialAvatar name={tenant.name} />
            <div>
              <strong>{tenant.name}</strong>
              <span>{roleLabel[tenant.role ?? "PRIMARY"]}{tenant.phone ? ` · ${formatThaiPhone(tenant.phone)}` : ""}</span>
            </div>
          </li>)}
        </ul>}
      </div>
      <dl className="room-detail-facts">
        <dt>สัญญา</dt><dd>{primary?.contractEnd ? `ถึง ${formatThaiDate(primary.contractEnd)}` : "-"}</dd>
        <dt>บิลล่าสุด</dt>
        <dd>{latestInvoice
          ? <>{formatThaiMonth(latestInvoice.month)} {currency.format(totalInvoice(latestInvoice))} <span className="today-label" data-tone={isOverdue ? "urgent" : latestInvoice.status === "paid" ? "done" : "neutral"}>{statusText[latestInvoice.status]}</span></>
          : "-"}</dd>
        <dt>มิเตอร์น้ำ</dt><dd>{room.waterMeter.toLocaleString("th-TH")} หน่วย</dd>
        <dt>มิเตอร์ไฟ</dt><dd>{room.electricMeter.toLocaleString("th-TH")} หน่วย</dd>
      </dl>
    </> : <div className="room-detail-section">
      <p className="room-detail-title">{room.status === "maintenance" ? "ห้องนี้ปิดซ่อมอยู่" : "ห้องนี้ว่าง พร้อมให้เช่า"}</p>
      <p className="room-detail-muted">{room.status === "maintenance"
        ? "เปลี่ยนสถานะเป็นว่างได้จากการจัดการห้องเมื่องานซ่อมเสร็จ"
        : "สร้างรหัสเชิญได้ที่ตั้งค่าหอ แท็บคำเชิญผู้เช่า แล้วคัดลอกส่งให้ผู้เช่าสมัครเอง"}</p>
    </div>}
    <div className="room-detail-actions">
      <button className={readOnly ? "secondary-button" : "primary-button"} onClick={onEditRoom} type="button">{readOnly ? "ดูรายละเอียดห้อง" : "จัดการห้อง"}</button>
    </div>
  </aside>;
}
