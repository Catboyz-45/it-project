// หน้าผังห้อง ใช้ state เก็บชั้นที่เลือกและรูปแบบการแสดงผล
import { useMemo, useState } from "react";
import { Building2, CircleDollarSign, DoorOpen, Grid2X2, Hammer, List, UsersRound } from "lucide-react";
import { currency, getStatusClass, statusText } from "@/lib/dorm-utils";
import type { Invoice, Room } from "@/types/dorm";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";

// ดูห้องได้สองแบบ การ์ดแบ่งตามอาคารกับชั้น หรือตารางเรียงยาว
export function RoomsPage({
  invoices,
  rooms,
  onEditRoom,
  readOnly = false,
  selectedRoom,
  setSelectedRoomId,
}: {
  invoices: Invoice[];
  rooms: Room[];
  onEditRoom: () => void;
  readOnly?: boolean;
  selectedRoom?: Room;
  setSelectedRoomId: (roomId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
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
    .sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id, "th", { numeric: true }));
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleRooms);
  const occupied = rooms.filter((room) => room.status === "occupied").length;
  const available = rooms.filter((room) => room.status === "available").length;
  const maintenance = rooms.filter((room) => room.status === "maintenance").length;
  // ทำเป็น Set เพราะข้างล่างต้องเช็คทีละห้องหลายรอบ Set เช็คได้เร็วกว่าไล่หาในอาเรย์
  const overdueRooms = new Set(
    invoices.filter((invoice) => invoice.status === "overdue").map((invoice) => invoice.roomId),
  );
  // จัดกลุ่มไว้ใช้กับมุมมองการ์ด มุมมองตารางใช้รายการเรียงยาวตามปกติ
  const roomGroups = useMemo(() => groupRoomsByBuildingAndFloor(visibleRooms), [visibleRooms]);

  // เลือกห้องแล้วเปิดกล่องแก้ไข สองอย่างนี้ต้องทำคู่กันเสมอ จึงรวมไว้ที่เดียว
  const openRoomManagement = (roomId: string) => {
    setSelectedRoomId(roomId);
    onEditRoom();
  };

  return (
    <section className="figma-rooms-page rooms-page-content">
      {readOnly ? <ReadOnlyNotice>เลือกห้องเพื่อดูรายละเอียดได้ และยังกรองชั้นหรือเปลี่ยนรูปแบบการแสดงผลได้ แต่ไม่สามารถแก้ไขข้อมูลห้อง</ReadOnlyNotice> : null}
      <div className="figma-summary-grid six">
        <Summary icon={<Building2 />} label="ห้องทั้งหมด" tone="indigo" value={rooms.length} />
        <Summary icon={<UsersRound />} label="มีผู้เช่า" tone="green" value={occupied} />
        <Summary icon={<DoorOpen />} label="ห้องว่าง" tone="blue" value={available} />
        <Summary icon={<CircleDollarSign />} label="ค้างชำระ" tone="red" value={overdueRooms.size} />
        <Summary icon={<Hammer />} label="อยู่ระหว่างซ่อม" tone="orange" value={maintenance} />
        <Summary icon={<Building2 />} label="จำนวนชั้น" tone="indigo" value={floors.length} />
      </div>
      <div className="rooms-view-toolbar">
        <div className="figma-inline-tabs floor-tabs" aria-label="เลือกชั้น" onKeyDown={handleFloorKeyDown} role="tablist">
          <button aria-controls="rooms-results-panel" aria-selected={selectedFloor === "all"} className={selectedFloor === "all" ? "active" : ""} id="rooms-floor-tab-all" onClick={() => setSelectedFloor("all")} role="tab" tabIndex={selectedFloor === "all" ? 0 : -1} type="button">ทุกชั้น</button>
          {floors.map((floor) => <button aria-controls="rooms-results-panel" aria-selected={selectedFloor === floor} className={selectedFloor === floor ? "active" : ""} id={`rooms-floor-tab-${floor}`} key={floor} onClick={() => setSelectedFloor(floor)} role="tab" tabIndex={selectedFloor === floor ? 0 : -1} type="button">ชั้น {floor}</button>)}
        </div>
        <div className="rooms-view-toggle" aria-label="รูปแบบการแสดงผังห้อง" onKeyDown={handleViewKeyDown} role="tablist">
          <button aria-controls="rooms-results-panel" aria-selected={viewMode === "card"} className={viewMode === "card" ? "active" : ""} id="rooms-view-tab-card" onClick={() => setViewMode("card")} role="tab" tabIndex={viewMode === "card" ? 0 : -1} type="button"><Grid2X2 aria-hidden="true" size={17} /> การ์ด</button>
          <button aria-controls="rooms-results-panel" aria-selected={viewMode === "table"} className={viewMode === "table" ? "active" : ""} id="rooms-view-tab-table" onClick={() => setViewMode("table")} role="tab" tabIndex={viewMode === "table" ? 0 : -1} type="button"><List aria-hidden="true" size={18} /> ตาราง</button>
        </div>
      </div>
      {/* key เปลี่ยนตามชั้นและมุมมอง เพื่อบังคับให้ React วาดใหม่ทั้งก้อน อนิเมชันเปลี่ยนหน้าจะได้เล่น */}
      <div aria-label={`ผลการแสดงห้อง ${selectedFloor === "all" ? "ทุกชั้น" : `ชั้น ${selectedFloor}`} รูปแบบ${viewMode === "card" ? "การ์ด" : "ตาราง"}`} className="view-transition" id="rooms-results-panel" key={`${selectedFloor}-${viewMode}`} role="tabpanel" tabIndex={0}>
      {/* ว่างเพราะเลือกชั้นที่ไม่มีห้อง กับว่างเพราะยังไม่มีห้องเลย ต้องบอกคนละแบบ */}
      {visibleRooms.length === 0 && selectedFloor !== "all" ? <SearchEmptyState description="ลองเลือกชั้นอื่นหรือกลับไปดูทุกชั้น" title="ไม่พบห้องในชั้นที่เลือก" /> : visibleRooms.length === 0 ? <div className="empty-state">ยังไม่มีห้องพัก</div> : viewMode === "card" ? (
        <div className="room-building-stack">
          {roomGroups.map((building) => (
            <section className="room-building-card" key={building.name}>
              <header className="room-building-head">
                <div><h2>{building.name}</h2><p>{building.roomCount.toLocaleString("th-TH")} ห้อง · {building.floors.length.toLocaleString("th-TH")} ชั้น</p></div>
              </header>
              <div className="room-floor-stack">
                {building.floors.map((floor) => (
                  <section className="room-floor-group" key={`${building.name}-${floor.number}`}>
                    <header><div><strong>ชั้น {floor.number}</strong><small>{floor.rooms.length.toLocaleString("th-TH")} ห้อง</small></div><span aria-hidden="true" /></header>
                    {/* ใส่เลขห้องกับสถานะใน label เพราะทุกการ์ดหน้าตาเหมือนกันหมด */}
                    <div className="room-plan-grid">
                      {floor.rooms.map((room) => (
                        <button aria-label={`${readOnly ? "เปิดรายละเอียด" : "เปิดหน้าจัดการ"}ห้อง ${room.id} สถานะ${statusText[room.status]}`} className={`room-plan-card interactive-card ${selectedRoom?.id === room.id ? "selected" : ""}`} key={room.databaseId ?? `${building.name}-${room.floor}-${room.id}`} onClick={() => openRoomManagement(room.id)} type="button">
                          <span className="room-plan-card-head"><strong>ห้อง {room.id}</strong><span className={getStatusClass(room.status)}>{statusText[room.status]}</span></span>
                          <span className="room-plan-card-detail">{roomTypeLabel(room.roomType)} · {currency.format(room.rent)}/เดือน</span>
                          <span className="room-plan-card-foot"><span>{room.status === "occupied" ? "มีผู้เช่า" : room.status === "maintenance" ? "กำลังซ่อมบำรุง" : "พร้อมเปิดเช่า"}</span>{overdueRooms.has(room.id) ? <strong>ค้างชำระ</strong> : <span className="interactive-card-action">{readOnly ? "ดูรายละเอียด" : "จัดการ"} <span aria-hidden="true">→</span></span>}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <article className="figma-table-card">
          <div className="additional-card-head"><div><h2>รายการห้องพัก</h2><p>ข้อมูลห้องเรียงตามอาคาร ชั้น และเลขห้อง</p></div></div>
          <div className="figma-table-wrap">
            <table className="figma-table rooms-data-table">
              <thead><tr><th scope="col">ห้อง</th><th scope="col">อาคาร</th><th scope="col">ชั้น</th><th scope="col">ประเภท</th><th scope="col">ค่าเช่า</th><th scope="col">ผู้เช่า</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr></thead>
              <tbody>{pageItems.map((room) => (
                <tr className={selectedRoom?.id === room.id ? "selected" : ""} key={room.databaseId ?? `${room.buildingName}-${room.floor}-${room.id}`}>
                  <td><strong>ห้อง {room.id}</strong></td>
                  <td>{room.buildingName || "อาคารหลัก"}</td>
                  <td>ชั้น {room.floor}</td>
                  <td>{roomTypeLabel(room.roomType)}</td>
                  <td><strong>{currency.format(room.rent)}</strong></td>
                  <td>{room.status === "occupied" ? "มีผู้เช่า" : "-"}</td>
                  <td><span className={getStatusClass(room.status)}>{statusText[room.status]}</span></td>
                  <td><button className="secondary-button" onClick={() => openRoomManagement(room.id)} type="button">ดูข้อมูล</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <TablePagination page={page} setPage={setPage} totalItems={visibleRooms.length} totalPages={totalPages} />
        </article>
      )}
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
      rooms: floorRooms.sort((a, b) => a.id.localeCompare(b.id, "th", { numeric: true })),
    })).sort((a, b) => a.number - b.number);
    return { name, roomCount: groupedFloors.reduce((total, floor) => total + floor.rooms.length, 0), floors: groupedFloors };
  }).sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
}

// แปลงประเภทห้องเป็นคำไทย ค่าที่ไม่รู้จักก็แสดงตามเดิม ดีกว่าโชว์ว่างเปล่า
function roomTypeLabel(roomType: string) {
  if (roomType === "air") return "ห้องแอร์";
  if (roomType === "fan") return "ห้องพัดลม";
  return roomType;
}

// การ์ดตัวเลขสรุปด้านบน ใช้แค่ในไฟล์นี้ จึงไม่ต้อง export
function Summary({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: number }) {
  return <article className={`figma-summary-card compact tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
