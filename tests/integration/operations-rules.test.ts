import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { createAnnouncement, createParcel, updateAnnouncement, updateParcel } from "@/lib/server/property-operations";
import { createSubscriptionOrder, createSubscriptionPayment } from "@/lib/server/subscription-orders";
import { createInvitation, registerTenant } from "@/lib/server/tenant-onboarding";
import { createWorkspaceFixture } from "./helpers";

// กฎที่ต้องปฏิเสธในงานประจำวัน ทดสอบที่ชั้น service โดยตรง
// เป้าหมายของประกาศต้องอยู่ในหอนี้ การแก้ไขพร้อมกันต้องชนกันอย่างปลอดภัย และคำเชิญต้องไม่เกินความจุห้อง

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;

beforeAll(async () => {
  w = await createWorkspaceFixture("OPS_RULES");
}, 60_000);

afterAll(async () => {
  if (!w) return;
  await getDatabase().subscriptionOrder.deleteMany({ where: { propertyId: w.property.id } });
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("announcement targets", () => {
  const base = { title: "ประกาศ", content: "เนื้อหา", status: "DRAFT" as const, roomIds: [] as string[] };

  it("requires and checks the building, floor or rooms that the audience points at", async () => {
    await expect(createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "BUILDING" })).rejects.toMatchObject({ status: 400 });
    await expect(createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "FLOOR" })).rejects.toMatchObject({ status: 400 });
    await expect(createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "ROOM" })).rejects.toMatchObject({ status: 400 });
    // id ของหออื่นต้องไม่ผ่าน กันยิงประกาศข้ามหอ
    await expect(createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "BUILDING", buildingId: w.otherProperty.id })).rejects.toMatchObject({ status: 400 });
    await expect(createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "FLOOR", floorId: w.otherProperty.id })).rejects.toMatchObject({ status: 400 });
    await expect(createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "ROOM", roomIds: [w.room.id, w.otherProperty.id] })).rejects.toMatchObject({ status: 400 });

    const building = await createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "BUILDING", buildingId: w.building.id });
    const floor = await createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "FLOOR", floorId: w.floor.id });
    expect(building.status).toBe("DRAFT");
    expect(floor.status).toBe("DRAFT");
  });

  it("retargets an announcement to rooms and publishes it, and refuses an unknown one", async () => {
    const created = await createAnnouncement(w.property.id, w.owner.id, { ...base, audience: "BUILDING", buildingId: w.building.id });
    const updated = await updateAnnouncement(w.property.id, created.id, {
      audience: "ROOM", roomIds: [w.room.id, w.room.id], status: "PUBLISHED", expectedUpdatedAt: created.updatedAt,
    });
    expect(updated.status).toBe("PUBLISHED");
    const stored = await getDatabase().announcement.findUniqueOrThrow({
      where: { id: created.id }, select: { buildingId: true, publishedAt: true, rooms: { select: { roomId: true } } },
    });
    expect(stored.buildingId).toBeNull();
    expect(stored.publishedAt).not.toBeNull();
    expect(stored.rooms).toEqual([{ roomId: w.room.id }]);
    await expect(updateAnnouncement(w.property.id, w.otherProperty.id, { title: "x", expectedUpdatedAt: new Date() })).rejects.toMatchObject({ status: 404 });
  });
});

describe("parcel updates", () => {
  it("rejects a stale edit, a recipient from another room, and a parcel that is no longer waiting", async () => {
    const parcel = await createParcel(w.property.id, w.owner.id, { roomId: w.room.id, note: "ซองเอกสาร" });
    const current = await getDatabase().parcel.findUniqueOrThrow({ where: { id: parcel.id }, select: { updatedAt: true } });

    await expect(updateParcel(w.property.id, parcel.id, { note: "ช้า", expectedUpdatedAt: new Date(0) })).rejects.toMatchObject({ status: 409 });
    await expect(updateParcel(w.property.id, parcel.id, { status: "RECEIVED", receivedByTenantId: w.otherOwner.id })).rejects.toMatchObject({ status: 400 });

    const noted = await updateParcel(w.property.id, parcel.id, { note: "ฝากไว้ที่ป้อม", expectedUpdatedAt: current.updatedAt });
    expect(noted.status).toBe("WAITING");
    const cancelled = await updateParcel(w.property.id, parcel.id, { status: "CANCELLED" });
    expect(cancelled.status).toBe("CANCELLED");
    await expect(updateParcel(w.property.id, parcel.id, { note: "อีกครั้ง" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("subscription orders", () => {
  it("allows one open order at a time and prices yearly plans from the monthly price when no yearly price is set", async () => {
    const plan = await getDatabase().saasPlan.findUniqueOrThrow({ where: { id: w.planId }, select: { monthlyPrice: true, yearlyPrice: true } });
    expect(plan.yearlyPrice).toBeNull();
    const order = await createSubscriptionOrder(w.property.id, w.owner.id, { planId: w.planId, billingInterval: "YEARLY" });
    expect(Number(order.amount)).toBe(Number(plan.monthlyPrice) * 12);
    expect(order.type).toBe("RENEWAL");
    await expect(createSubscriptionOrder(w.property.id, w.owner.id, { planId: w.planId, billingInterval: "MONTHLY" })).rejects.toMatchObject({ status: 409 });
    await expect(createSubscriptionOrder(w.otherOwner.id, w.owner.id, { planId: w.planId, billingInterval: "MONTHLY" })).rejects.toMatchObject({ status: 404 });
  });

  it("expires an order whose payment window has passed, and refuses slips for unknown or closed orders", async () => {
    const order = await getDatabase().subscriptionOrder.findFirstOrThrow({ where: { propertyId: w.property.id }, select: { id: true } });
    const slip = { propertyId: w.property.id, submittedByUserId: w.owner.id, storageKey: "subscription-slips/x.png", mimeType: "image/png", sizeBytes: 10 };
    await expect(createSubscriptionPayment({ ...slip, orderId: w.otherProperty.id })).rejects.toMatchObject({ status: 404 });

    const later = new Date(Date.now() + 3 * 86_400_000);
    await expect(createSubscriptionPayment({ ...slip, orderId: order.id }, later)).rejects.toMatchObject({ status: 409 });
    const expired = await getDatabase().subscriptionOrder.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    expect(expired.status).toBe("EXPIRED");
    await expect(createSubscriptionPayment({ ...slip, orderId: order.id })).rejects.toMatchObject({ status: 409 });
  });
});

describe("invitations", () => {
  async function register(code: string, label: string) {
    const registration = await registerTenant({
      invitationCode: code, email: `${label}-${w.suffix}@example.test`, password: "Tenant-Password-123",
      displayName: label, phone: "0812345678", termsAccepted: true, privacyAcknowledged: true, marketingConsent: false,
    });
    w.extraUserIds.push(registration.userId);
    return registration;
  }

  it("refuses a second primary tenant, a full room, and a code that was already used", async () => {
    // ห้องนี้มีผู้เช่าหลักอยู่แล้วจาก fixture จึงออกคำเชิญผู้เช่าหลักเพิ่มไม่ได้ตั้งแต่แรก
    await expect(createInvitation(w.property.id, w.owner.id, { roomId: w.room.id, intendedRole: "PRIMARY", expiresInDays: 7 }))
      .rejects.toMatchObject({ status: 409 });

    // ความจุห้องคือ 2 มีผู้เช่าหลักแล้วหนึ่ง รับผู้พักร่วมได้อีกหนึ่งคน
    const first = await createInvitation(w.property.id, w.owner.id, { roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 7 });
    const second = await createInvitation(w.property.id, w.owner.id, { roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 7 });
    await register(first.invitationCode, "co-one");
    await expect(register(second.invitationCode, "co-two")).rejects.toMatchObject({ status: 409 });
    await expect(register(first.invitationCode, "co-again")).rejects.toMatchObject({ status: 400 });
  });
});
