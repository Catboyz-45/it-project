import { describe, expect, it } from "vitest";
import {
  countInvitationRooms,
  defaultInvitationRoomId,
  filterInvitationRooms,
  type InvitationRoomOption,
  invitationRoomState,
  invitationRoomStateLabel,
  isInvitationRoomSelectable,
  suggestedInvitationRole,
} from "@/lib/domain/invitation-rooms";

function room(overrides: Partial<InvitationRoomOption> = {}): InvitationRoomOption {
  return {
    id: overrides.number ?? "101",
    number: "101",
    buildingName: "อาคาร A",
    floorNumber: 1,
    status: "AVAILABLE",
    capacity: 2,
    occupantCount: 0,
    hasPrimaryTenant: false,
    primaryTenantName: null,
    pendingInvitationCount: 0,
    ...overrides,
  };
}

const vacant = room({ number: "101" });
const invited = room({ number: "102", pendingInvitationCount: 1 });
const occupied = room({ number: "103", status: "OCCUPIED", occupantCount: 1, hasPrimaryTenant: true, primaryTenantName: "สมชาย ใจดี" });
const full = room({ number: "104", status: "OCCUPIED", capacity: 1, occupantCount: 1, hasPrimaryTenant: true, primaryTenantName: "สุดา สุขใจ" });
const repairing = room({ number: "201", status: "MAINTENANCE", floorNumber: 2 });
const rooms = [vacant, invited, occupied, full, repairing];

describe("invitation room state", () => {
  it("follows the same rules the server checks when creating an invitation", () => {
    expect(rooms.map(invitationRoomState)).toEqual(["vacant", "invited", "occupied", "full", "closed"]);
    expect(rooms.map(invitationRoomStateLabel)).toEqual(["ว่าง", "มีคำเชิญค้าง", "มีผู้เช่าหลัก", "เต็ม", "ปิดซ่อม"]);
    expect(invitationRoomStateLabel(room({ status: "INACTIVE" }))).toBe("ปิดใช้งาน");
  });

  it("lets only rooms with space and open for tenants be picked", () => {
    expect(rooms.filter(isInvitationRoomSelectable).map((option) => option.number)).toEqual(["101", "102", "103"]);
  });

  it("closed beats full, and full beats an existing main tenant", () => {
    expect(invitationRoomState(room({ status: "MAINTENANCE", occupantCount: 2, capacity: 2 }))).toBe("closed");
    expect(invitationRoomState(room({ occupantCount: 2, capacity: 2, pendingInvitationCount: 3 }))).toBe("full");
  });

  it("suggests a co-occupant invitation when the room already has a main tenant", () => {
    expect(suggestedInvitationRole(vacant)).toBe("PRIMARY");
    expect(suggestedInvitationRole(occupied)).toBe("CO_OCCUPANT");
  });
});

describe("filtering and searching rooms", () => {
  it("shows rooms that can still take a main tenant by default, and hides closed rooms outside 'all'", () => {
    expect(filterInvitationRooms(rooms, "", "available").map((option) => option.number)).toEqual(["101", "102"]);
    expect(filterInvitationRooms(rooms, "", "occupied").map((option) => option.number)).toEqual(["103", "104"]);
    expect(filterInvitationRooms(rooms, "", "all")).toHaveLength(5);
  });

  it("matches room number, building, or main tenant name, ignoring case and surrounding spaces", () => {
    expect(filterInvitationRooms(rooms, " 20 ", "all").map((option) => option.number)).toEqual(["201"]);
    expect(filterInvitationRooms(rooms, "สมชาย", "all").map((option) => option.number)).toEqual(["103"]);
    expect(filterInvitationRooms([room({ buildingName: "Tower B" })], "tower b", "all")).toHaveLength(1);
    expect(filterInvitationRooms(rooms, "ไม่มีห้องนี้", "all")).toEqual([]);
  });

  it("counts each filter against the current search text", () => {
    expect(countInvitationRooms(rooms, "")).toEqual({ available: 2, occupied: 2, all: 5 });
    expect(countInvitationRooms(rooms, "10")).toEqual({ available: 2, occupied: 2, all: 4 });
  });
});

describe("default room", () => {
  it("prefers a vacant room without a pending invitation, then any room that can be picked", () => {
    expect(defaultInvitationRoomId(rooms)).toBe("101");
    expect(defaultInvitationRoomId([invited, occupied])).toBe("102");
    expect(defaultInvitationRoomId([full, repairing])).toBe("");
    expect(defaultInvitationRoomId([])).toBe("");
  });
});
