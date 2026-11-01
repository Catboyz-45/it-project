// ช่องเลือกห้องตอนสร้างคำเชิญ บอกสถานะของแต่ละห้องโดยไม่ต้องกดเข้าไปดู
// กฎตรงกับที่ createInvitation ตรวจฝั่งเซิร์ฟเวอร์ ห้องที่เลือกได้ในรายการจึงสร้างคำเชิญได้จริง

export type InvitationRoomOption = {
  id: string;
  number: string;
  buildingName: string;
  floorNumber: number;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "INACTIVE";
  capacity: number;
  // นับเฉพาะการเข้าพักที่รออนุมัติหรือกำลังพักอยู่ เหมือนตอนเซิร์ฟเวอร์ตรวจความจุ
  occupantCount: number;
  hasPrimaryTenant: boolean;
  primaryTenantName: string | null;
  // คำเชิญที่ยังไม่มีใครใช้และยังไม่หมดอายุ
  pendingInvitationCount: number;
};

// closed = ปิดซ่อมหรือปิดใช้งาน full = คนเต็มความจุ ทั้งสองแบบสร้างคำเชิญไม่ได้
export type InvitationRoomState = "vacant" | "invited" | "occupied" | "full" | "closed";

// ตัวกรองบนช่องเลือก ค่าเริ่มต้นคือห้องที่ยังรับผู้เช่าหลักได้
export type InvitationRoomFilter = "available" | "occupied" | "all";

export function invitationRoomState(room: InvitationRoomOption): InvitationRoomState {
  if (room.status === "MAINTENANCE" || room.status === "INACTIVE") return "closed";
  if (room.occupantCount >= room.capacity) return "full";
  if (room.hasPrimaryTenant) return "occupied";
  return room.pendingInvitationCount > 0 ? "invited" : "vacant";
}

export function invitationRoomStateLabel(room: InvitationRoomOption) {
  const state = invitationRoomState(room);
  if (state === "closed") return room.status === "MAINTENANCE" ? "ปิดซ่อม" : "ปิดใช้งาน";
  const labels: Record<Exclude<InvitationRoomState, "closed">, string> = {
    vacant: "ว่าง",
    invited: "มีคำเชิญค้าง",
    occupied: "มีผู้เช่าหลัก",
    full: "เต็ม",
  };
  return labels[state];
}

export function isInvitationRoomSelectable(room: InvitationRoomOption) {
  const state = invitationRoomState(room);
  return state !== "full" && state !== "closed";
}

// ห้องที่มีผู้เช่าหลักแล้วเชิญได้แค่ผู้พักร่วม เลือกห้องแบบนี้แล้วเปลี่ยนสิทธิ์ให้เลย จะได้ไม่ชนข้อห้ามตอนกดสร้าง
export function suggestedInvitationRole(room: InvitationRoomOption): "PRIMARY" | "CO_OCCUPANT" {
  return room.hasPrimaryTenant ? "CO_OCCUPANT" : "PRIMARY";
}

function matchesFilter(state: InvitationRoomState, filter: InvitationRoomFilter) {
  if (filter === "available") return state === "vacant" || state === "invited";
  if (filter === "occupied") return state === "occupied" || state === "full";
  return true;
}

// ค้นจากเลขห้อง ชื่ออาคาร หรือชื่อผู้เช่าหลัก ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างหัวท้าย
function matchesQuery(room: InvitationRoomOption, query: string) {
  const needle = query.trim().toLocaleLowerCase("th-TH");
  if (!needle) return true;
  return [room.number, room.buildingName, room.primaryTenantName ?? ""]
    .some((value) => value.toLocaleLowerCase("th-TH").includes(needle));
}

export function filterInvitationRooms(rooms: readonly InvitationRoomOption[], query: string, filter: InvitationRoomFilter) {
  return rooms.filter((room) => matchesFilter(invitationRoomState(room), filter) && matchesQuery(room, query));
}

// ตัวเลขบนปุ่มกรองนับตามคำค้นที่พิมพ์อยู่ด้วย ผู้ใช้จะเห็นว่าสลับตัวกรองแล้วจะเจอกี่ห้อง
export function countInvitationRooms(rooms: readonly InvitationRoomOption[], query: string): Record<InvitationRoomFilter, number> {
  return {
    available: filterInvitationRooms(rooms, query, "available").length,
    occupied: filterInvitationRooms(rooms, query, "occupied").length,
    all: filterInvitationRooms(rooms, query, "all").length,
  };
}

// ห้องที่ควรเลือกไว้ให้ตอนเปิดหน้า ห้องว่างที่ยังไม่มีคำเชิญก่อน แล้วค่อยห้องอื่นที่เลือกได้
export function defaultInvitationRoomId(rooms: readonly InvitationRoomOption[]) {
  return (rooms.find((room) => invitationRoomState(room) === "vacant")
    ?? rooms.find(isInvitationRoomSelectable))?.id ?? "";
}
