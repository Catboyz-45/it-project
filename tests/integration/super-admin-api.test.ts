import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { cleanupIntegrationFixture, createWorkspaceFixture } from "./helpers";
import { callApi } from "./route-client";

// งานของผู้ดูแลระบบผ่าน API จริง แดชบอร์ด รายงาน แพ็กเกจ หอพัก บัญชีเจ้าของหอ และแชตช่วยเหลือ

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
const admin = () => ({ cookie: w.cookies.superAdmin });
const createdPropertyIds: string[] = [];
const createdPlanIds: string[] = [];

beforeAll(async () => {
  w = await createWorkspaceFixture("SUPER_API");
}, 60_000);

afterAll(async () => {
  if (!w) return;
  if (createdPropertyIds.length) await cleanupIntegrationFixture({ propertyIds: createdPropertyIds, userIds: [] });
  await w.cleanup();
  await getDatabase().saasPlan.deleteMany({ where: { id: { in: createdPlanIds } } });
  await getDatabase().$disconnect();
});

describe("overview pages and CSV exports", () => {
  it("reads the dashboard, notifications and audit logs", async () => {
    expect((await callApi("GET", "/api/v1/super-admin/dashboard", admin())).status).toBe(200);
    expect((await callApi("GET", "/api/v1/super-admin/notifications", admin())).status).toBe(200);
    const logs = await callApi("GET", "/api/v1/super-admin/audit-logs?query=API&result=SUCCESS", admin());
    expect(logs.status).toBe(200);
    expect((await callApi("GET", "/api/v1/super-admin/audit-logs?result=NOT_A_RESULT", admin())).status).toBe(400);
  });

  it("lists users, properties and plans with filters", async () => {
    const users = await callApi("GET", `/api/v1/super-admin/users?approvalStatus=APPROVED&query=${encodeURIComponent(w.owner.email)}`, admin());
    expect(users.status).toBe(200);
    const properties = await callApi("GET", `/api/v1/super-admin/properties?activeOnly=true&query=${encodeURIComponent(w.property.shortName)}`, admin());
    expect(properties.status).toBe(200);
    const plans = await callApi("GET", "/api/v1/super-admin/plans?activeOnly=true&query=STARTER", admin());
    expect(plans.status).toBe(200);
  });

  it("exports every list as CSV that a spreadsheet opens safely", async () => {
    for (const resource of ["users", "properties", "plans", "audit-logs"]) {
      const exported = await callApi("GET", `/api/v1/super-admin/${resource}/export`, admin());
      expect(exported.status, resource).toBe(200);
      expect(exported.headers.get("content-type"), resource).toContain("text/csv");
      expect(exported.headers.get("content-disposition"), resource).toContain("attachment");
      expect(exported.text?.length, resource).toBeGreaterThan(0);
    }
  });
});

describe("SaaS plans", () => {
  const code = () => `PLAN_${w.suffix.toUpperCase()}`;

  it("creates a plan, refuses the same code twice, and edits it", async () => {
    const body = { code: code(), name: "แพ็กเกจทดสอบ", monthlyPrice: 500, yearlyPrice: 5000, maxProperties: 1, maxRooms: 30 };
    const created = await callApi("POST", "/api/v1/super-admin/plans", { ...admin(), body });
    expect(created.status).toBe(201);
    const planId = created.json.data.id;
    createdPlanIds.push(planId);
    expect((await callApi("POST", "/api/v1/super-admin/plans", { ...admin(), body })).status).toBe(409);

    const edited = await callApi("PATCH", `/api/v1/super-admin/plans/${planId}`, { ...admin(), body: { name: "แพ็กเกจแก้ไข", isActive: false } });
    expect(edited.status).toBe(200);
    expect(edited.json.data).toMatchObject({ name: "แพ็กเกจแก้ไข", isActive: false });
    expect((await callApi("PATCH", `/api/v1/super-admin/plans/${planId}`, { ...admin(), body: {} })).status).toBe(400);
    expect((await callApi("PATCH", `/api/v1/super-admin/plans/${randomCuid()}`, { ...admin(), body: { name: "ไม่มีจริง" } })).status).toBe(404);
  });
});

describe("properties and owner accounts", () => {
  let propertyId = "";
  let ownerId = "";

  it("creates a property on the starter trial", async () => {
    const created = await callApi("POST", "/api/super-admin/properties", { ...admin(), body: { name: `หอใหม่ ${w.suffix}`, shortName: `NEW-${w.suffix}` } });
    expect(created.status).toBe(201);
    propertyId = created.json.id;
    createdPropertyIds.push(propertyId);
    const subscription = await getDatabase().propertySubscription.findUniqueOrThrow({ where: { propertyId }, select: { status: true } });
    expect(subscription.status).toBe("TRIAL");
  });

  it("creates an owner account for that property and refuses a duplicate email or unknown property", async () => {
    const body = { email: `new-owner-${w.suffix}@example.test`, displayName: "เจ้าของใหม่", password: "Owner-Password-123", propertyIds: [propertyId] };
    const created = await callApi("POST", "/api/super-admin/users", { ...admin(), body });
    expect(created.status).toBe(201);
    ownerId = created.json.id;
    w.extraUserIds.push(ownerId);
    expect((await callApi("POST", "/api/super-admin/users", { ...admin(), body })).status).toBe(409);
    const unknownProperty = { ...body, email: `other-${w.suffix}@example.test`, propertyIds: [randomCuid()] };
    expect((await callApi("POST", "/api/super-admin/users", { ...admin(), body: unknownProperty })).status).toBe(400);
  });

  it("reassigns owner memberships", async () => {
    const path = `/api/v1/super-admin/users/${ownerId}/memberships`;
    const updated = await callApi("PATCH", path, { ...admin(), body: { propertyIds: [propertyId, w.otherProperty.id, propertyId] } });
    expect(updated.status).toBe(200);
    const memberships = await getDatabase().propertyMembership.findMany({ where: { userId: ownerId }, select: { propertyId: true } });
    expect(memberships.map((row) => row.propertyId).sort()).toEqual([propertyId, w.otherProperty.id].sort());
    expect((await callApi("PATCH", `/api/v1/super-admin/users/${w.tenantUserId}/memberships`, { ...admin(), body: { propertyIds: [] } })).status).toBe(404);
    await callApi("PATCH", path, { ...admin(), body: { propertyIds: [propertyId] } });
  });

  it("reads a property, changes its members, and closes then reopens it", async () => {
    const path = `/api/v1/super-admin/properties/${propertyId}`;
    expect((await callApi("GET", path, admin())).status).toBe(200);
    // บัญชีที่ยังรออนุมัติมอบหมายให้ดูแลหอไม่ได้
    expect((await callApi("PATCH", path, { ...admin(), body: { memberUserIds: [ownerId] } })).status).toBe(400);
    expect((await callApi("PATCH", `/api/v1/super-admin/users/${ownerId}/approval`, { ...admin(), body: { status: "APPROVED" } })).status).toBe(200);
    expect((await callApi("PATCH", path, { ...admin(), body: { memberUserIds: [ownerId] } })).status).toBe(200);
    expect((await callApi("PATCH", path, { ...admin(), body: { isActive: false } })).status).toBe(200);
    const closed = await getDatabase().property.findUniqueOrThrow({ where: { id: propertyId }, select: { isActive: true } });
    expect(closed.isActive).toBe(false);
    expect((await callApi("PATCH", path, { ...admin(), body: { isActive: true } })).status).toBe(200);
    expect((await callApi("GET", `/api/v1/super-admin/properties/${randomCuid()}`, admin())).status).toBe(404);
  });

  it("assigns a paid plan to the property and validates the dates", async () => {
    const path = `/api/v1/super-admin/properties/${propertyId}/subscription`;
    const startsAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const assigned = await callApi("PUT", path, { ...admin(), body: { planId: "plan_growth", startsAt, expiresAt } });
    expect(assigned.status).toBe(200);
    const subscription = await getDatabase().propertySubscription.findUniqueOrThrow({ where: { propertyId }, select: { status: true, planId: true } });
    expect(subscription).toMatchObject({ status: "ACTIVE", planId: "plan_growth" });
    expect((await callApi("PUT", path, { ...admin(), body: { planId: "plan_growth", startsAt: expiresAt, expiresAt: startsAt } })).status).toBe(400);
    // แพ็กเกจที่ไม่มีหรือปิดขายแล้วเป็นความผิดของข้อมูลที่ส่งมา จึงได้ 400
    expect((await callApi("PUT", path, { ...admin(), body: { planId: "plan_does_not_exist", startsAt, expiresAt } })).status).toBe(400);
  });
});

describe("owner account approval", () => {
  async function pendingOwner(label: string) {
    const user = await getDatabase().user.create({
      data: {
        email: `${label}-${w.suffix}@example.test`, passwordHash: "x", displayName: label,
        role: "PROPERTY_ADMIN", approvalStatus: "PENDING",
      },
      select: { id: true },
    });
    w.extraUserIds.push(user.id);
    return user.id;
  }

  it("approves once and refuses to review the same account again", async () => {
    const userId = await pendingOwner("approve-me");
    const path = `/api/v1/super-admin/users/${userId}/approval`;
    expect((await callApi("PATCH", path, { ...admin(), body: { status: "APPROVED" } })).status).toBe(200);
    expect((await callApi("PATCH", path, { ...admin(), body: { status: "REJECTED", rejectionReason: "ซ้ำ" } })).status).toBe(409);
  });

  it("requires a reason to reject", async () => {
    const userId = await pendingOwner("reject-me");
    const path = `/api/v1/super-admin/users/${userId}/approval`;
    expect((await callApi("PATCH", path, { ...admin(), body: { status: "REJECTED" } })).status).toBe(400);
    expect((await callApi("PATCH", path, { ...admin(), body: { status: "REJECTED", rejectionReason: "ข้อมูลไม่ครบ" } })).status).toBe(200);
    expect((await callApi("PATCH", "/api/v1/super-admin/users/bad-id/approval", { ...admin(), body: { status: "APPROVED" } })).status).toBe(404);
  });
});

describe("support chat between an owner and Super Admin", () => {
  it("delivers messages both ways and lists the conversation for Super Admin", async () => {
    const ownerPath = `/api/v1/admin/properties/${w.property.id}/support-chat`;
    const adminPath = `/api/v1/super-admin/properties/${w.property.id}/support-chat`;

    const fromOwner = await callApi("POST", ownerPath, { cookie: w.cookies.owner, body: { body: "ช่วยด้วยครับ", clientId: randomUUID() } });
    expect(fromOwner.status).toBe(201);
    const inbox = await callApi("GET", "/api/v1/super-admin/support-chat", admin());
    expect(inbox.status).toBe(200);

    const reply = await callApi("POST", adminPath, { ...admin(), body: { body: "ยินดีช่วยครับ", clientId: randomUUID() } });
    expect(reply.status).toBe(201);
    const thread = await callApi("GET", `${adminPath}?limit=10`, admin());
    expect(thread.status).toBe(200);
    expect(thread.json.messages.map((message: { body: string }) => message.body)).toEqual(expect.arrayContaining(["ช่วยด้วยครับ", "ยินดีช่วยครับ"]));
    const ownerView = await callApi("GET", ownerPath, { cookie: w.cookies.owner });
    expect(ownerView.status).toBe(200);

    expect((await callApi("POST", adminPath, { ...admin(), body: { body: "   ", clientId: randomUUID() } })).status).toBe(400);
  });
});

describe("subscription payment review", () => {
  it("lists payments and returns 404 for an unknown payment", async () => {
    expect((await callApi("GET", "/api/v1/super-admin/subscription-payments?query=x", admin())).status).toBe(200);
    expect((await callApi("PATCH", `/api/v1/super-admin/subscription-payments/${randomCuid()}`, { ...admin(), body: { status: "APPROVED" } })).status).toBe(404);
    expect((await callApi("GET", `/api/v1/super-admin/subscription-payments/${randomCuid()}/slip`, admin())).status).toBe(404);
  });
});

// cuid ที่ถูกรูปแบบแต่ไม่มีอยู่จริง ใช้ทดสอบกรณีไม่พบข้อมูล
function randomCuid() {
  return `c${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}
