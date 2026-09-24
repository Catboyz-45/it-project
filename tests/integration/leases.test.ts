import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { createLease, getLease, getSignedLeaseKey, listLeases } from "@/lib/server/leases";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let tenantUserId = "";
let foreignTemplateId = "";
let ownTemplateId = "";

const pagination = { page: 1, pageSize: 20 };
const leaseInput = () => ({
  roomId: fixture!.room.id,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-12-31"),
  monthlyRent: 3000,
  depositAmount: 6000,
});

beforeAll(async () => {
  fixture = await createIntegrationFixture();

  const tenant = await getDatabase().user.create({
    data: {
      email: `lease-tenant-${fixture.suffix}@example.com`,
      displayName: "ผู้เช่าสัญญา",
      role: "TENANT",
      approvalStatus: "APPROVED",
      passwordHash: "x",
      tenantProfile: { create: { phone: "0865556666" } },
    },
    select: { id: true, tenantProfile: { select: { id: true } } },
  });
  tenantUserId = tenant.id;
  await getDatabase().roomOccupancy.create({
    data: {
      propertyId: fixture.property.id,
      roomId: fixture.room.id,
      tenantProfileId: tenant.tenantProfile!.id,
      role: "PRIMARY",
      status: "ACTIVE",
    },
  });

  // template หนึ่งอันของหอนี้ อีกอันของหออื่น ไว้ทดสอบว่าข้ามหอไม่ได้
  const own = await getDatabase().documentTemplate.create({
    data: { propertyId: fixture.property.id, kind: "CONTRACT", name: "สัญญามาตรฐาน", html: "<p>{{tenant_name}}</p>" },
    select: { id: true },
  });
  ownTemplateId = own.id;
  const foreign = await getDatabase().documentTemplate.create({
    data: { propertyId: fixture.otherProperty.id, kind: "CONTRACT", name: "สัญญาหออื่น", html: "<p>{{tenant_name}}</p>" },
    select: { id: true },
  });
  foreignTemplateId = foreign.id;
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [tenantUserId, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id].filter(Boolean),
  });
  await getDatabase().$disconnect();
});

describe("lease service", () => {
  // id ของ template มาจากคำขอ ถ้าไม่ผูกกับหอที่กำลังทำงานอยู่
  // เจ้าของหอหนึ่งจะเอาแบบสัญญาของอีกหอมาใช้ได้ด้วยการเดา id
  it("refuses a contract template that belongs to another property", async () => {
    await expect(createLease(fixture!.property.id, fixture!.owner.id, {
      ...leaseInput(),
      templateId: foreignTemplateId,
    })).rejects.toMatchObject({ status: 400 });

    const created = await getDatabase().lease.count({ where: { propertyId: fixture!.property.id } });
    expect(created).toBe(0);
  });

  it("creates a lease with a template from this property", async () => {
    const lease = await createLease(fixture!.property.id, fixture!.owner.id, {
      ...leaseInput(),
      templateId: ownTemplateId,
    });
    expect(lease.leaseNumber).toContain(fixture!.room.number);
  });

  // ห้องหนึ่งมีสัญญาที่ใช้งานอยู่ได้ฉบับเดียว ต้องปิดของเดิมก่อนหรือใช้การต่ออายุแทน
  // ฉบับร่างไม่นับ จึงต้องดันฉบับแรกให้ถึงขั้นรอลงนามก่อนถึงจะเห็นกฎข้อนี้ทำงาน
  it("allows another draft but refuses a second live lease on the same room", async () => {
    const extraDraft = await createLease(fixture!.property.id, fixture!.owner.id, leaseInput());
    expect(extraDraft.status).toBe("DRAFT");
    await getDatabase().lease.delete({ where: { id: extraDraft.id } });

    const [first] = (await listLeases(fixture!.property.id, pagination)).data;
    await getDatabase().lease.update({ where: { id: first.id }, data: { status: "PENDING_SIGNATURE" } });

    await expect(createLease(fixture!.property.id, fixture!.owner.id, leaseInput()))
      .rejects.toMatchObject({ status: 409 });

    await getDatabase().lease.update({ where: { id: first.id }, data: { status: "DRAFT" } });
  });

  it("lists leases and narrows them by query", async () => {
    const all = await listLeases(fixture!.property.id, pagination);
    expect(all.data.length).toBeGreaterThan(0);

    const byRoom = await listLeases(fixture!.property.id, pagination, fixture!.room.number);
    expect(byRoom.data.length).toBeGreaterThan(0);

    const noMatch = await listLeases(fixture!.property.id, pagination, "ไม่มีทางตรงกับอะไรเลย");
    expect(noMatch.data).toHaveLength(0);
  });

  it("reads one lease and hides leases of other properties", async () => {
    const [first] = (await listLeases(fixture!.property.id, pagination)).data;
    const lease = await getLease(fixture!.property.id, first.id);
    expect(lease.id).toBe(first.id);

    await expect(getLease(fixture!.otherProperty.id, first.id)).rejects.toMatchObject({ status: 404 });
  });

  // ยังไม่ได้แนบเอกสารลงนาม ต้องตอบว่าไม่พบ ไม่ใช่คืนคีย์ว่างให้ไปเปิดไฟล์ที่ไม่มีอยู่
  it("reports no signed document until one is attached", async () => {
    const [first] = (await listLeases(fixture!.property.id, pagination)).data;
    await expect(getSignedLeaseKey(fixture!.property.id, first.id)).rejects.toMatchObject({ status: 404 });
  });
});
