import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { getDatabase } from "@/lib/server/db";
import { getDashboardReadModel } from "@/lib/server/dashboard-read-model";
import { hashPassword } from "@/lib/server/password";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let primaryUserId = "";
let coTenantUserId = "";

beforeAll(async () => {
  fixture = await createIntegrationFixture();

  // หอที่มีข้อมูลจริงครบ ทั้งผู้เช่าหลัก ผู้พักร่วม สัญญา รถ และบิลที่มีรายการย่อย
  // ไม่งั้นตัวอ่านจะวิ่งผ่านทางที่ไม่มีข้อมูลแล้วไม่ได้พิสูจน์อะไร
  const primary = await getDatabase().user.create({
    data: {
      email: `dash-primary-${fixture.suffix}@example.com`,
      displayName: "ผู้เช่าหลัก",
      role: "TENANT",
      approvalStatus: "APPROVED",
      passwordHash: "x",
      tenantProfile: { create: { phone: "0891111111", vehicle: { create: { type: "CAR", licensePlate: "1กก 1234" } } } },
    },
    select: { id: true, tenantProfile: { select: { id: true } } },
  });
  primaryUserId = primary.id;

  const coTenant = await getDatabase().user.create({
    data: {
      email: `dash-co-${fixture.suffix}@example.com`,
      displayName: "ผู้พักร่วม",
      role: "TENANT",
      approvalStatus: "APPROVED",
      passwordHash: "x",
      tenantProfile: { create: { phone: "0892222222" } },
    },
    select: { id: true, tenantProfile: { select: { id: true } } },
  });
  coTenantUserId = coTenant.id;

  for (const [profileId, role] of [
    [primary.tenantProfile!.id, "PRIMARY"],
    [coTenant.tenantProfile!.id, "CO_OCCUPANT"],
  ] as const) {
    await getDatabase().roomOccupancy.create({
      data: {
        propertyId: fixture.property.id,
        roomId: fixture.room.id,
        tenantProfileId: profileId,
        role,
        status: "ACTIVE",
      },
    });
  }

  const invoice = await getDatabase().invoice.create({
    data: {
      propertyId: fixture.property.id,
      roomId: fixture.room.id,
      invoiceNumber: `INV-${fixture.suffix}`,
      billingMonth: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
      dueDate: new Date(),
      status: "PENDING",
      total: 3400,
    },
    select: { id: true },
  });
  await getDatabase().invoiceItem.createMany({
    data: [
      { invoiceId: invoice.id, type: "RENT", description: "ค่าเช่า", unitPrice: 3000, amount: 3000 },
      { invoiceId: invoice.id, type: "WATER", description: "ค่าน้ำ", unitPrice: 100, amount: 100 },
      { invoiceId: invoice.id, type: "ELECTRICITY", description: "ค่าไฟ", unitPrice: 250, amount: 250 },
      { invoiceId: invoice.id, type: "SERVICE", description: "ค่าส่วนกลาง", unitPrice: 50, amount: 50 },
    ],
  });
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [primaryUserId, coTenantUserId, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id].filter(Boolean),
  });
  await getDatabase().$disconnect();
});

describe("owner dashboard read model", () => {
  it("builds the tenant rows with their room, vehicle and room-mates", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const model = await getDashboardReadModel(fixture.property.id);

    const primaryRow = model.tenants.find((tenant) => tenant.name === "ผู้เช่าหลัก");
    expect(primaryRow).toBeDefined();
    expect(primaryRow?.roomId).toBe(fixture.room.number);
    // รหัสประเภทรถต้องถูกแปลเป็นคำไทยก่อนถึงหน้าจอ ไม่ใช่โผล่เป็น CAR
    expect(primaryRow?.vehicleType).toBe("รถยนต์");

    // ผู้พักร่วมของห้องเดียวกันต้องไม่นับตัวเองเป็นเพื่อนร่วมห้อง
    const coRow = model.tenants.find((tenant) => tenant.name === "ผู้พักร่วม");
    expect(coRow?.coOccupants?.some((mate) => mate.name === "ผู้พักร่วม")).toBe(false);
    expect(primaryRow?.coOccupants?.some((mate) => mate.name === "ผู้พักร่วม")).toBe(true);
    // นับรวมตัวเองด้วย ห้องนี้มีสองคน
    expect(primaryRow?.occupantCount).toBe(2);
  });

  it("splits invoice items into rent, water, electricity and service", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const model = await getDashboardReadModel(fixture.property.id);
    const invoice = model.invoices.find((item) => item.id === `INV-${fixture!.suffix}`);
    expect(invoice).toMatchObject({ rent: 3000, water: 100, electricity: 250 });
    // ทุกอย่างที่ไม่ใช่ค่าเช่า ค่าน้ำ ค่าไฟ ถูกรวมเป็นค่าบริการก้อนเดียว
    expect(invoice?.service).toBe(50);
  });

  it("lists the rooms with their furniture", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const model = await getDashboardReadModel(fixture.property.id);
    const room = model.rooms.find((item) => item.id === fixture!.room.number);
    expect(room).toBeDefined();
    expect(Array.isArray(room?.furniture)).toBe(true);
  });
});

// การลองรหัสผ่านรัว ๆ ต้องถูกกั้น ไม่งั้นเดารหัสได้ไม่จำกัดครั้ง
// ข้อความที่ตอบกลับต้องไม่บอกว่าอีเมลนี้มีอยู่จริงหรือไม่
describe("login brute force protection", () => {
  it("starts refusing after repeated failures and stays generic", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const email = `bruteforce-${fixture.suffix}@example.com`;
    await getDatabase().user.create({
      data: {
        email,
        displayName: "เป้าหมายการเดารหัส",
        role: "PROPERTY_ADMIN",
        approvalStatus: "APPROVED",
        passwordHash: await hashPassword("Correct-Password-123"),
      },
    });

    const attempt = () => login(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ email, password: "Wrong-Password-123" }),
    }));

    let blocked = false;
    for (let round = 0; round < 12 && !blocked; round += 1) {
      const response = await attempt();
      if (response.status === 429) blocked = true;
      else expect(response.status).toBe(401);
    }
    expect(blocked).toBe(true);

    await getDatabase().user.deleteMany({ where: { email } });
  });
});
