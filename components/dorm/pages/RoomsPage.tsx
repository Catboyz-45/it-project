/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Rooms Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useMemo, useState } from "react";
import { Building2, CircleDollarSign, DoorOpen, Grid2X2, Hammer, List, UsersRound } from "lucide-react";
import { currency, getStatusClass, statusText } from "@/lib/dorm-utils";
import type { Invoice, Room } from "@/types/dorm";
import { TablePagination, useTablePagination } from "@/components/dorm/TablePagination";
import { ReadOnlyNotice } from "@/components/dorm/ReadOnlyNotice";
import { useTablistKeyboard } from "@/components/ui/use-tablist-keyboard";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Rooms Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { invoices, rooms, onEditRoom, readOnly = false, selectedRoo: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “floors” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - a: ค่า “a” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - b: ค่า “b” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const floors = [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b);
  const floorTabs: Array<number | "all"> = ["all", ...floors];
  const viewTabs = ["card", "table"] as const;
  const handleFloorKeyDown = useTablistKeyboard(floorTabs, setSelectedFloor);
  const handleViewKeyDown = useTablistKeyboard(viewTabs, setViewMode);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “visible Rooms” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - a: ค่า “a” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - b: ค่า “b” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const visibleRooms = rooms
    .filter((room) => selectedFloor === "all" || room.floor === selectedFloor)
    .sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id, "th", { numeric: true }));
  const { page, pageItems, setPage, totalPages } = useTablePagination(visibleRooms);
  const occupied = rooms.filter((room) => room.status === "occupied").length;
  const available = rooms.filter((room) => room.status === "available").length;
  const maintenance = rooms.filter((room) => room.status === "maintenance").length;
  const overdueRooms = new Set(
    invoices.filter((invoice) => invoice.status === "overdue").map((invoice) => invoice.roomId),
  );
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “room Groups” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const roomGroups = useMemo(() => groupRoomsByBuildingAndFloor(visibleRooms), [visibleRooms]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “open Room Management” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - roomId: รหัสภายในของห้องพัก
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
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
      <div aria-label={`ผลการแสดงห้อง ${selectedFloor === "all" ? "ทุกชั้น" : `ชั้น ${selectedFloor}`} รูปแบบ${viewMode === "card" ? "การ์ด" : "ตาราง"}`} className="view-transition" id="rooms-results-panel" key={`${selectedFloor}-${viewMode}`} role="tabpanel" tabIndex={0}>
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
              <thead><tr><th>ห้อง</th><th>อาคาร</th><th>ชั้น</th><th>ประเภท</th><th>ค่าเช่า</th><th>ผู้เช่า</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Room Building Group” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type RoomBuildingGroup = {
  name: string;
  roomCount: number;
  floors: Array<{ number: number; rooms: Room[] }>;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “group Rooms By Building And Floor” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - rooms: ค่า “rooms” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด RoomBuildingGroup[] ตามสัญญา TypeScript ของฟังก์ชัน
 */
function groupRoomsByBuildingAndFloor(rooms: Room[]): RoomBuildingGroup[] {
  const buildings = new Map<string, Map<number, Room[]>>();
  rooms.forEach((room) => {
    const buildingName = room.buildingName?.trim() || "อาคารหลัก";
    const floors = buildings.get(buildingName) ?? new Map<number, Room[]>();
    const floorRooms = floors.get(room.floor) ?? [];
    floorRooms.push(room);
    floors.set(room.floor, floorRooms);
    buildings.set(buildingName, floors);
  });

  return Array.from(buildings, ([name, floorMap]) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “grouped Floors” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - a: ค่า “a” ที่จำเป็นต่อการทำงานของก้อนนี้
     * - b: ค่า “b” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const groupedFloors = Array.from(floorMap, ([number, floorRooms]) => ({
      number,
      rooms: floorRooms.sort((a, b) => a.id.localeCompare(b.id, "th", { numeric: true })),
    })).sort((a, b) => a.number - b.number);
    return { name, roomCount: groupedFloors.reduce((total, floor) => total + floor.rooms.length, 0), floors: groupedFloors };
  }).sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “room Type Label” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - roomType: ค่า “room Type” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function roomTypeLabel(roomType: string) {
  if (roomType === "air") return "ห้องแอร์";
  if (roomType === "fan") return "ห้องพัดลม";
  return roomType;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Summary” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { icon, label, tone, value }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
function Summary({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: string; value: number }) {
  return <article className={`figma-summary-card compact tone-${tone}`}><div><small>{label}</small><strong>{value}</strong></div><span>{icon}</span></article>;
}
