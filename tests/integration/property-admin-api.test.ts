import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { generateInvoice, issueInvoice } from "@/lib/server/invoices";
import { recordMeterReading } from "@/lib/server/meters";
import { createInvitation, registerTenant } from "@/lib/server/tenant-onboarding";
import { createWorkspaceFixture } from "./helpers";
import { callApi } from "./route-client";

// เส้นทางงานหลักของเจ้าของหอผ่าน API จริง ตั้งค่าหอ โครงสร้างอาคาร ผู้เช่า คำเชิญ และการย้ายออก
// เรียกผ่าน route handler ทุกครั้ง จึงทดสอบทั้งการตรวจข้อมูลเข้า ด่านสิทธิ์ และกฎธุรกิจในชั้น service ไปพร้อมกัน

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
let base = "";
const owner = () => ({ cookie: w.cookies.owner });

beforeAll(async () => {
  w = await createWorkspaceFixture("ADMIN_API");
  base = `/api/v1/admin/properties/${w.property.id}`;
}, 60_000);

afterAll(async () => {
  if (!w) return;
  await getDatabase().occupancyTransition.deleteMany({ where: { propertyId: w.property.id } });
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("property identity and settings", () => {
  it("reads and renames the property", async () => {
    const read = await callApi("GET", base, owner());
    expect(read.status).toBe(200);

    const renamed = await callApi("PATCH", base, { ...owner(), body: { name: "หอทดสอบ API" } });
    expect(renamed.status).toBe(200);
    const stored = await getDatabase().property.findUniqueOrThrow({ where: { id: w.property.id }, select: { name: true } });
    expect(stored.name).toBe("หอทดสอบ API");
  });

  it("refuses an empty rename", async () => {
    expect((await callApi("PATCH", base, { ...owner(), body: {} })).status).toBe(400);
  });

  it("saves the full settings form and rejects an unknown field", async () => {
    const settings = {
      legalName: "บริษัท หอทดสอบ จำกัด",
      lessorName: "เจ้าของทดสอบ",
      address: "99 ถนนทดสอบ",
      contactPhone: "0811111111",
      contactEmail: "Owner@Example.test",
      promptPayId: "0812345678",
      waterUnitRate: 20,
      electricityUnitRate: 8,
      billingDay: 1,
      dueDay: 7,
      lateFeePerDay: 25,
      lateFeeCap: 300,
      invoicePrefix: "TST",
      invoiceFooter: "ขอบคุณที่ชำระตรงเวลา",
      houseRules: "ห้ามส่งเสียงดังหลัง 22.00 น.",
      emergencyContact: "ยาม 0899999999",
    };
    const saved = await callApi("PUT", `${base}/settings`, { ...owner(), body: settings });
    expect(saved.status).toBe(200);
    const read = await callApi("GET", `${base}/settings`, owner());
    expect(read.status).toBe(200);
    const stored = await getDatabase().propertySettings.findUniqueOrThrow({
      where: { propertyId: w.property.id },
      select: { contactEmail: true, dueDay: true },
    });
    // อีเมลถูกแปลงเป็นตัวพิมพ์เล็กก่อนเก็บ
    expect(stored).toMatchObject({ contactEmail: "owner@example.test", dueDay: 7 });

    const extra = await callApi("PUT", `${base}/settings`, { ...owner(), body: { ...settings, isAdmin: true } });
    expect(extra.status).toBe(400);
  });

  it("replaces the property catalogs and rejects duplicate names", async () => {
    const catalogs = {
      roomTypes: [{ name: "Standard", rent: 3500, deposit: 7000, capacity: 2 }],
      serviceCharges: [{ name: "ค่าส่วนกลาง", amount: 200, frequency: "monthly", calculation: "room" }],
      furnitureOptions: [{ name: "เตียง", isDefault: true }, { name: "ตู้เย็น", isDefault: false }],
    };
    expect((await callApi("PUT", `${base}/catalogs`, { ...owner(), body: catalogs })).status).toBe(200);
    const duplicate = { ...catalogs, furnitureOptions: [{ name: "เตียง", isDefault: true }, { name: "เตียง", isDefault: false }] };
    expect((await callApi("PUT", `${base}/catalogs`, { ...owner(), body: duplicate })).status).toBe(400);
  });
});

describe("buildings, floors and rooms", () => {
  let buildingId = "";
  let floorId = "";
  let roomId = "";

  it("creates a building with floors and refuses a duplicate code", async () => {
    const body = { name: "อาคาร B", code: `B-${w.suffix}`, floors: [{ number: 1 }, { number: 2, label: "ชั้นสอง" }] };
    const created = await callApi("POST", `${base}/buildings`, { ...owner(), body });
    expect(created.status).toBe(201);
    buildingId = created.json.data.id;
    floorId = created.json.data.floors[0].id;
    expect(created.json.data.floors).toHaveLength(2);

    expect((await callApi("POST", `${base}/buildings`, { ...owner(), body })).status).toBe(409);
    // หมายเลขชั้นซ้ำกันในคำขอเดียวต้องไม่ผ่านการตรวจข้อมูล
    const repeatedFloors = { ...body, code: `C-${w.suffix}`, floors: [{ number: 1 }, { number: 1 }] };
    expect((await callApi("POST", `${base}/buildings`, { ...owner(), body: repeatedFloors })).status).toBe(400);

    const list = await callApi("GET", `${base}/buildings`, owner());
    expect(list.status).toBe(200);
  });

  it("renames a building and refuses to take another building's code", async () => {
    expect((await callApi("PATCH", `${base}/buildings/${buildingId}`, { ...owner(), body: { name: "อาคาร B ใหม่" } })).status).toBe(200);
    const clash = await callApi("PATCH", `${base}/buildings/${buildingId}`, { ...owner(), body: { code: w.building.code } });
    expect(clash.status).toBe(409);
    expect((await callApi("PATCH", `${base}/buildings/not-a-cuid`, { ...owner(), body: { name: "x" } })).status).toBe(404);
  });

  it("adds and relabels a floor", async () => {
    const added = await callApi("POST", `${base}/buildings/${buildingId}/floors`, { ...owner(), body: { number: 3, label: "ดาดฟ้า" } });
    expect(added.status).toBe(201);
    // ชั้นหมายเลขเดิมในอาคารเดียวกันซ้ำไม่ได้
    expect((await callApi("POST", `${base}/buildings/${buildingId}/floors`, { ...owner(), body: { number: 3 } })).status).toBe(409);
    const relabeled = await callApi("PATCH", `${base}/buildings/${buildingId}/floors/${floorId}`, { ...owner(), body: { label: null } });
    expect(relabeled.status).toBe(200);
  });

  it("creates and updates a room, then refuses to close a building that still has open rooms", async () => {
    const room = {
      buildingId, floorId, number: `B101-${w.suffix}`, roomType: "Standard",
      monthlyRent: 3600, depositAmount: 7200, capacity: 2, furniture: ["เตียง", "ตู้เย็น"],
    };
    const created = await callApi("POST", `${base}/rooms`, { ...owner(), body: room });
    expect(created.status).toBe(201);
    roomId = created.json.data.id;
    expect(created.json.data.furniture).toEqual(expect.arrayContaining(["เตียง", "ตู้เย็น"]));
    expect((await callApi("POST", `${base}/rooms`, { ...owner(), body: room })).status).toBe(409);

    const updated = await callApi("PATCH", `${base}/rooms/${roomId}`, {
      ...owner(), body: { monthlyRent: 3900, furniture: ["เตียง"], roomType: "Deluxe" },
    });
    expect(updated.status).toBe(200);
    expect(updated.json.data).toMatchObject({ monthlyRent: "3900", roomType: "Deluxe", furniture: ["เตียง"] });

    const closeBuilding = await callApi("PATCH", `${base}/buildings/${buildingId}`, { ...owner(), body: { isActive: false } });
    expect(closeBuilding.status).toBe(409);

    expect((await callApi("PATCH", `${base}/rooms/${roomId}`, { ...owner(), body: { status: "INACTIVE" } })).status).toBe(200);
    expect((await callApi("PATCH", `${base}/buildings/${buildingId}`, { ...owner(), body: { isActive: false } })).status).toBe(200);
    expect((await callApi("GET", `${base}/rooms`, owner())).status).toBe(200);
  });

  it("refuses a room on a floor of another building", async () => {
    const otherFloor = await callApi("POST", `${base}/rooms`, {
      ...owner(),
      body: { buildingId: w.building.id, floorId, number: `X-${w.suffix}`, roomType: "Standard", monthlyRent: 1000 },
    });
    expect(otherFloor.status).toBeGreaterThanOrEqual(400);
    expect(otherFloor.status).toBeLessThan(500);
  });
});

describe("tenants", () => {
  it("lists, searches and reads tenants", async () => {
    const list = await callApi("GET", `${base}/tenants`, owner());
    expect(list.status).toBe(200);
    expect(list.json.data.map((tenant: { id: string }) => tenant.id)).toContain(w.tenantProfileId);

    const search = await callApi("GET", `${base}/tenants?query=${encodeURIComponent("ADMIN_API Tenant")}`, owner());
    expect(search.json.data).toHaveLength(1);
    const miss = await callApi("GET", `${base}/tenants?query=nobody-matches-this`, owner());
    expect(miss.json.data).toHaveLength(0);

    expect((await callApi("GET", `${base}/tenants/${w.tenantProfileId}`, owner())).status).toBe(200);
    expect((await callApi("GET", `${base}/tenants/${w.otherOwner.id}`, owner())).status).toBe(404);
  });

  it("updates a tenant profile with a vehicle, then removes the vehicle", async () => {
    const path = `${base}/tenants/${w.tenantProfileId}`;
    const withVehicle = await callApi("PATCH", path, {
      ...owner(),
      body: {
        displayName: "ผู้เช่าแก้ชื่อ", phone: "0898887777", address: "บ้านเลขที่ 1",
        vehicle: { type: "MOTORCYCLE", licensePlate: "1กข 1234", province: "นครปฐม", color: "ดำ" },
      },
    });
    expect(withVehicle.status).toBe(200);
    expect(withVehicle.json.data.vehicle).toMatchObject({ licensePlate: "1กข 1234" });

    // อัปเดตรถคันเดิมซ้ำต้องแก้แถวเดิม ไม่สร้างใหม่
    expect((await callApi("PATCH", path, { ...owner(), body: { vehicle: { type: "CAR", licensePlate: "กก 1" } } })).status).toBe(200);
    const listed = await callApi("GET", `${base}/tenants`, owner());
    expect(listed.json.data.find((tenant: { id: string }) => tenant.id === w.tenantProfileId))
      .toMatchObject({ vehiclePlate: "กก 1", name: "ผู้เช่าแก้ชื่อ" });

    const removed = await callApi("PATCH", path, { ...owner(), body: { vehicle: null } });
    expect(removed.json.data.vehicle).toBeNull();
    expect((await callApi("PATCH", path, { ...owner(), body: {} })).status).toBe(400);
  });

  // ช่องเหล่านี้เคยแสดงบนฟอร์มแต่ไม่ถูกบันทึก ต้องบันทึกแล้วอ่านกลับมาได้ครบ
  it("saves identity details and the owner note, then clears them", async () => {
    const path = `${base}/tenants/${w.tenantProfileId}`;
    const saved = await callApi("PATCH", path, {
      ...owner(),
      body: {
        namePrefix: "นางสาว", nickname: "มิ้นท์", nationality: "ไทย", nationalId: "1-1017-00230-70-8",
        birthDate: "2001-05-20", lineId: "mint.line", occupation: "นักศึกษา", organization: "มหาวิทยาลัยทดสอบ",
        studentOrEmployeeId: "6501234", emergencyRelation: "มารดา", ownerNote: "แพ้ฝุ่น ขอห้องติดหน้าต่าง",
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.json.data).toMatchObject({ nationalId: "1101700230708", emergencyRelation: "มารดา" });

    const listed = await callApi("GET", `${base}/tenants`, owner());
    expect(listed.json.data.find((tenant: { id: string }) => tenant.id === w.tenantProfileId)).toMatchObject({
      prefix: "นางสาว", nickname: "มิ้นท์", nationality: "ไทย", nationalId: "1101700230708", birthDate: "2001-05-20",
      lineId: "mint.line", occupation: "นักศึกษา", organization: "มหาวิทยาลัยทดสอบ", studentOrEmployeeId: "6501234",
      guardianRelation: "มารดา", note: "แพ้ฝุ่น ขอห้องติดหน้าต่าง",
    });

    // เลขตรวจสอบผิดต้องโดนปฏิเสธ และค่าเดิมต้องไม่เปลี่ยน
    expect((await callApi("PATCH", path, { ...owner(), body: { nationalId: "1101700230709" } })).status).toBe(400);
    // ผู้เช่าเรียก API ของเจ้าของหอเพื่อแก้เลขของตัวเองไม่ได้
    expect((await callApi("PATCH", path, { cookie: w.cookies.tenant, body: { nationalId: null } })).status).toBe(403);

    const cleared = await callApi("PATCH", path, { ...owner(), body: { nationalId: null, ownerNote: null } });
    expect(cleared.status).toBe(200);
    const relisted = await callApi("GET", `${base}/tenants`, owner());
    expect(relisted.json.data.find((tenant: { id: string }) => tenant.id === w.tenantProfileId))
      .toMatchObject({ nationalId: "", note: "", nickname: "มิ้นท์" });
  });
});

describe("invitations and occupancy review", () => {
  it("creates, lists and revokes an invitation once", async () => {
    const created = await callApi("POST", `${base}/invitations`, { ...owner(), body: { roomId: w.room.id, expiresInDays: 3 } });
    expect(created.status).toBe(201);
    const invitationId = created.json.data.invitation.id;
    expect((await callApi("GET", `${base}/invitations`, owner())).status).toBe(200);
    expect((await callApi("DELETE", `${base}/invitations/${invitationId}`, owner())).status).toBe(204);
    // ยกเลิกซ้ำไม่ได้ เพราะไม่อยู่ในสถานะรอใช้แล้ว
    expect((await callApi("DELETE", `${base}/invitations/${invitationId}`, owner())).status).toBe(404);
  });

  it("approves a co-occupant and ends the stay when there is no lease", async () => {
    const invitation = await createInvitation(w.property.id, w.owner.id, {
      roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 7,
    });
    const registration = await registerTenant({
      invitationCode: invitation.invitationCode,
      email: `co-${w.suffix}@example.test`,
      password: "Tenant-Password-123",
      displayName: "ผู้พักร่วม",
      phone: "0811112222",
      termsAccepted: true,
      privacyAcknowledged: true,
      marketingConsent: false,
    });
    w.extraUserIds.push(registration.userId);
    const path = `${base}/occupancies/${registration.occupancy.id}`;

    expect((await callApi("GET", `${base}/occupancies`, owner())).status).toBe(200);
    expect((await callApi("PATCH", path, { ...owner(), body: { status: "ACTIVE" } })).status).toBe(200);
    const ended = await callApi("DELETE", path, { ...owner(), body: { reason: "ย้ายไปอยู่ที่อื่น" } });
    expect(ended.status).toBe(200);
    expect(ended.json.data.status).toBe("ENDED");
    // ปิดไปแล้วปิดซ้ำไม่ได้
    expect((await callApi("DELETE", path, { ...owner(), body: { reason: "ซ้ำ" } })).status).toBe(404);
  });
});

describe("move room and move out", () => {
  const today = () => new Date().toISOString().slice(0, 10);
  let destinationRoomId = "";

  beforeAll(async () => {
    const room = await getDatabase().room.create({
      data: {
        propertyId: w.property.id, buildingId: w.building.id, floorId: w.floor.id,
        number: `D-${w.suffix}`, roomType: "Standard", monthlyRent: 4000, depositAmount: 8000, capacity: 2,
      },
    });
    destinationRoomId = room.id;
  });

  it("reports that move-out is not ready before meters and the final invoice exist", async () => {
    const readiness = await callApi("GET", `${base}/tenants/${w.tenantProfileId}/transitions?effectiveDate=${today()}`, owner());
    expect(readiness.status).toBe(200);
    expect(readiness.json.data).toMatchObject({ ready: false, meters: { ready: false }, invoice: { ready: false } });

    const blocked = await callApi("POST", `${base}/tenants/${w.tenantProfileId}/transitions`, {
      ...owner(), body: { type: "MOVE_OUT", effectiveDate: today(), reason: "หมดสัญญา" },
    });
    expect(blocked.status).toBe(409);
  });

  it("rejects a future date, the same room, and a move without a destination", async () => {
    const path = `${base}/tenants/${w.tenantProfileId}/transitions`;
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    expect((await callApi("POST", path, { ...owner(), body: { type: "MOVE_ROOM", destinationRoomId, effectiveDate: future, reason: "x" } })).status).toBe(400);
    expect((await callApi("POST", path, { ...owner(), body: { type: "MOVE_ROOM", destinationRoomId: w.room.id, effectiveDate: today(), reason: "x" } })).status).toBe(409);
    expect((await callApi("POST", path, { ...owner(), body: { type: "MOVE_ROOM", effectiveDate: today(), reason: "x" } })).status).toBe(400);
  });

  it("moves the household to another room and carries the deposit over", async () => {
    const moved = await callApi("POST", `${base}/tenants/${w.tenantProfileId}/transitions`, {
      ...owner(),
      body: {
        type: "MOVE_ROOM", destinationRoomId, effectiveDate: today(), reason: "ขอห้องใหญ่ขึ้น",
        deductions: [{ label: "ทำความสะอาด", amount: 500 }],
      },
    });
    expect(moved.status).toBe(201);
    expect(moved.json.data).toMatchObject({ type: "MOVE_ROOM", refundAmount: 0 });
    expect(moved.json.data.transferredAmount).toBeGreaterThan(0);

    const occupancy = await getDatabase().roomOccupancy.findFirstOrThrow({
      where: { tenantProfileId: w.tenantProfileId, status: "ACTIVE" },
      select: { roomId: true },
    });
    expect(occupancy.roomId).toBe(destinationRoomId);
    const sourceRoom = await getDatabase().room.findUniqueOrThrow({ where: { id: w.room.id }, select: { status: true } });
    expect(sourceRoom.status).toBe("AVAILABLE");

    const history = await callApi("GET", `${base}/tenants/${w.tenantProfileId}/transitions`, owner());
    expect(history.json.data).toHaveLength(1);
    const all = await callApi("GET", `${base}/occupancy-transitions`, owner());
    expect(all.status).toBe(200);
    // ชื่อผู้เช่าถูกแก้ไปแล้วในชุดเทสต์ tenants ข้างบน
    expect(all.json.data[0]).toMatchObject({ type: "MOVE_ROOM", tenantName: "ผู้เช่าแก้ชื่อ" });
  });

  it("moves out once meters are recorded and the final invoice is issued", async () => {
    const billingMonth = today().slice(0, 7);
    await recordMeterReading(w.property.id, w.owner.id, {
      roomId: destinationRoomId, type: "WATER", billingMonth, previousReading: 10, currentReading: 15,
    });
    await recordMeterReading(w.property.id, w.owner.id, {
      roomId: destinationRoomId, type: "ELECTRICITY", billingMonth, previousReading: 100, currentReading: 150,
    });
    const draft = await generateInvoice(w.property.id, { roomId: destinationRoomId, billingMonth, issueImmediately: false });
    await issueInvoice(w.property.id, draft.id, draft.version);

    const ready = await callApi("GET", `${base}/tenants/${w.tenantProfileId}/transitions?effectiveDate=${today()}`, owner());
    expect(ready.json.data.ready).toBe(true);

    const movedOut = await callApi("POST", `${base}/tenants/${w.tenantProfileId}/transitions`, {
      ...owner(),
      body: { type: "MOVE_OUT", effectiveDate: today(), reason: "หมดสัญญา", settlementNote: "คืนกุญแจแล้ว" },
    });
    expect(movedOut.status).toBe(201);
    // ไม่มีสัญญาเช่า จึงใช้เงินประกันที่ตั้งไว้ในห้องปลายทาง (8,000) และนับยอดค้างเฉพาะบิลที่ผูกกับสัญญา
    expect(movedOut.json.data).toMatchObject({ type: "MOVE_OUT", depositAmount: 8000, outstandingAmount: 0, refundAmount: 8000 });
    const active = await getDatabase().roomOccupancy.count({ where: { tenantProfileId: w.tenantProfileId, status: "ACTIVE" } });
    expect(active).toBe(0);

    // ไม่มีการเข้าพักเหลือแล้ว ทำซ้ำต้องไม่พบ
    const again = await callApi("GET", `${base}/tenants/${w.tenantProfileId}/transitions?effectiveDate=${today()}`, owner());
    expect(again.status).toBe(404);
  });
});
