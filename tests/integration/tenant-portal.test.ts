import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import {
  getTenantAccount,
  getTenantNotificationSummary,
  getTenantRoom,
  listTenantInvoices,
  updateTenantAccount,
} from "@/lib/server/tenant-portal";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let tenantUserId = "";
let tenantProfileId = "";
let coTenantUserId = "";
let coTenantProfileId = "";

const pagination = { page: 1, pageSize: 20 };

async function createTenant(label: string, role: "PRIMARY" | "CO_OCCUPANT") {
  if (!fixture) throw new Error("Fixture was not initialized");
  const user = await getDatabase().user.create({
    data: {
      email: `portal-${label}-${fixture.suffix}@example.com`,
      displayName: `ผู้เช่า ${label}`,
      role: "TENANT",
      approvalStatus: "APPROVED",
      passwordHash: "x",
      tenantProfile: { create: { phone: "0891110000" } },
    },
    select: { id: true, tenantProfile: { select: { id: true } } },
  });
  const profileId = user.tenantProfile?.id ?? "";
  await getDatabase().roomOccupancy.create({
    data: {
      propertyId: fixture.property.id,
      roomId: fixture.room.id,
      tenantProfileId: profileId,
      role,
      status: "ACTIVE",
    },
  });
  return { userId: user.id, profileId };
}

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  const primary = await createTenant("primary", "PRIMARY");
  tenantUserId = primary.userId;
  tenantProfileId = primary.profileId;
  const co = await createTenant("co", "CO_OCCUPANT");
  coTenantUserId = co.userId;
  coTenantProfileId = co.profileId;
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [tenantUserId, coTenantUserId, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id].filter(Boolean),
  });
  await getDatabase().$disconnect();
});

describe("tenant portal read model", () => {
  it("returns the account with its occupancies", async () => {
    const account = await getTenantAccount(tenantProfileId);
    expect(account.occupancies.some((item) => item.room.number === fixture!.room.number)).toBe(true);
  });

  it("reports a missing profile rather than returning nothing", async () => {
    await expect(getTenantAccount("cm000000000000000000999")).rejects.toMatchObject({ status: 404 });
  });

  // id ของโปรไฟล์มาจากคำขอ จึงต้องพิสูจน์ว่าเป็นของผู้ใช้คนที่ล็อกอินอยู่จริง
  // ไม่ใช่เชื่อ id ที่ส่งมา มิฉะนั้นผู้เช่าคนหนึ่งแก้โปรไฟล์ของอีกคนได้
  it("refuses to update a profile that belongs to someone else", async () => {
    await expect(updateTenantAccount(tenantProfileId, coTenantUserId, {
      displayName: "ชื่อที่แอบเปลี่ยน",
      phone: "0800000000",
      address: null,
      emergencyName: null,
      emergencyPhone: null,
    })).rejects.toMatchObject({ status: 404 });

    const untouched = await getDatabase().user.findUnique({ where: { id: tenantUserId }, select: { displayName: true } });
    expect(untouched?.displayName).toBe("ผู้เช่า primary");
  });

  it("updates the name and profile together for the rightful owner", async () => {
    const account = await updateTenantAccount(tenantProfileId, tenantUserId, {
      displayName: "ชื่อใหม่",
      phone: "0899998888",
      address: "123 ถนนทดสอบ",
      emergencyName: "ผู้ติดต่อฉุกเฉิน",
      emergencyPhone: "0877776666",
    });
    expect(account.user.displayName).toBe("ชื่อใหม่");
    expect(account.phone).toBe("0899998888");
  });

  it("returns the room the tenant actually lives in", async () => {
    const view = await getTenantRoom(tenantProfileId, fixture!.room.id);
    expect(view.room.number).toBe(fixture!.room.number);
  });

  // ห้องที่ไม่ได้พักอยู่ต้องหาไม่เจอ ไม่ใช่เห็นข้อมูลห้องคนอื่นผ่านการเดา id
  it("cannot read a room the tenant does not occupy", async () => {
    const otherRoom = await getDatabase().room.findFirst({
      where: { propertyId: fixture!.otherProperty.id },
      select: { id: true },
    });
    if (!otherRoom) return;
    await expect(getTenantRoom(tenantProfileId, otherRoom.id)).rejects.toMatchObject({ status: 404 });
  });

  it("counts notifications for a primary tenant", async () => {
    const summary = await getTenantNotificationSummary(tenantProfileId, tenantUserId, fixture!.room.id, "PRIMARY");
    expect(summary).toMatchObject({
      unpaidInvoices: expect.any(Number),
      waitingParcels: expect.any(Number),
      openTickets: expect.any(Number),
      unreadMessages: expect.any(Number),
      unreadTicketReplies: expect.any(Number),
    });
  });

  // ผู้พักร่วมไม่เห็นบิล ตัวเลขจึงต้องเป็น 0 โดยไม่ต้องไปถามฐานข้อมูล
  it("reports no unpaid invoices for a co-occupant", async () => {
    const summary = await getTenantNotificationSummary(coTenantProfileId, coTenantUserId, fixture!.room.id, "CO_OCCUPANT");
    expect(summary.unpaidInvoices).toBe(0);
  });

  it("lists invoices for the primary tenant", async () => {
    const page = await listTenantInvoices(tenantProfileId, fixture!.room.id, "PRIMARY", pagination);
    expect(Array.isArray(page.data)).toBe(true);
  });

  // เงินเป็นเรื่องของผู้เช่าหลัก ผู้พักร่วมต้องถูกปฏิเสธตั้งแต่ก่อนแตะฐานข้อมูล
  it("refuses to list invoices for a co-occupant", async () => {
    await expect(listTenantInvoices(coTenantProfileId, fixture!.room.id, "CO_OCCUPANT", pagination))
      .rejects.toMatchObject({ status: 403 });
  });
});
