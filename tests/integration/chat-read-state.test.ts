import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import {
  ensureSupportConversation,
  ensureTenantConversation,
  listConversations,
  markConversationRead,
  type ConversationActor,
} from "@/lib/server/chat";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let tenantProfileId = "";
let tenantUserId = "";

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  const tenantUser = await getDatabase().user.create({
    data: {
      email: `chat-tenant-${fixture.suffix}@example.com`,
      displayName: "ผู้เช่าทดสอบแชท",
      role: "TENANT",
      approvalStatus: "APPROVED",
      passwordHash: "x",
      tenantProfile: { create: { phone: "0891112222" } },
    },
    select: { id: true, tenantProfile: { select: { id: true } } },
  });
  tenantUserId = tenantUser.id;
  tenantProfileId = tenantUser.tenantProfile?.id ?? "";
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [tenantUserId, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id].filter(Boolean),
  });
  await getDatabase().$disconnect();
});

const pagination = { page: 1, pageSize: 20 };

// แต่ละบทบาทมีช่องเก็บเวลาอ่านล่าสุดคนละช่อง ถ้าใช้ช่องเดียวกัน พอฝ่ายหนึ่งเปิดอ่าน
// อีกฝ่ายจะเห็นว่าอ่านไปแล้วทั้งที่ยังไม่ได้เปิด จำนวนที่ยังไม่ได้อ่านจึงต้องคิดแยกกัน
describe("chat read state per role", () => {
  it("keeps the owner and tenant read times independent", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const conversation = await ensureTenantConversation({
      propertyId: fixture.property.id,
      tenantProfileId,
      tenantName: "ผู้เช่าทดสอบแชท",
      roomNumber: fixture.room.number,
    });

    const tenant: ConversationActor = {
      userId: tenantUserId, role: "TENANT", propertyId: fixture.property.id, tenantProfileId,
    };
    await markConversationRead(conversation.id, tenant);

    const row = await getDatabase().chatConversation.findUnique({
      where: { id: conversation.id },
      select: { lastTenantReadAt: true, lastAdminReadAt: true, lastSuperAdminReadAt: true },
    });
    expect(row?.lastTenantReadAt).not.toBeNull();
    expect(row?.lastAdminReadAt).toBeNull();
    expect(row?.lastSuperAdminReadAt).toBeNull();

    const owner: ConversationActor = {
      userId: fixture.owner.id, role: "PROPERTY_ADMIN", propertyId: fixture.property.id,
    };
    await markConversationRead(conversation.id, owner);
    const afterOwner = await getDatabase().chatConversation.findUnique({
      where: { id: conversation.id },
      select: { lastAdminReadAt: true, lastSuperAdminReadAt: true },
    });
    expect(afterOwner?.lastAdminReadAt).not.toBeNull();
    // เจ้าของหออ่านแล้วต้องไม่ไปนับว่าผู้ดูแลระบบอ่านด้วย
    expect(afterOwner?.lastSuperAdminReadAt).toBeNull();
  });

  it("writes the super admin read time to its own column", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const conversation = await ensureSupportConversation(fixture.property.id);
    const superAdmin: ConversationActor = {
      userId: fixture.superAdmin.id, role: "SUPER_ADMIN", propertyId: fixture.property.id,
    };
    await markConversationRead(conversation.id, superAdmin);

    const row = await getDatabase().chatConversation.findUnique({
      where: { id: conversation.id },
      select: { lastSuperAdminReadAt: true, lastTenantReadAt: true },
    });
    expect(row?.lastSuperAdminReadAt).not.toBeNull();
    expect(row?.lastTenantReadAt).toBeNull();
  });

  // ผู้เช่าเห็นได้เฉพาะห้องสนทนาของตัวเอง และเปิดดูห้องสายซัพพอร์ตของหอไม่ได้
  it("limits each role to the conversation type it is allowed to see", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    await ensureTenantConversation({
      propertyId: fixture.property.id,
      tenantProfileId,
      tenantName: "ผู้เช่าทดสอบแชท",
      roomNumber: fixture.room.number,
    });
    await ensureSupportConversation(fixture.property.id);

    const tenant: ConversationActor = {
      userId: tenantUserId, role: "TENANT", propertyId: fixture.property.id, tenantProfileId,
    };
    const tenantView = await listConversations(tenant, "TENANT_PROPERTY", pagination);
    expect(tenantView.data.every((item) => item.type === "TENANT_PROPERTY")).toBe(true);

    await expect(listConversations(tenant, "PROPERTY_SUPPORT", pagination))
      .rejects.toMatchObject({ status: 403 });

    const superAdmin: ConversationActor = {
      userId: fixture.superAdmin.id, role: "SUPER_ADMIN", propertyId: fixture.property.id,
    };
    await expect(listConversations(superAdmin, "TENANT_PROPERTY", pagination))
      .rejects.toMatchObject({ status: 403 });
    const supportView = await listConversations(superAdmin, "PROPERTY_SUPPORT", pagination);
    expect(supportView.data.every((item) => item.type === "PROPERTY_SUPPORT")).toBe(true);
  });
});
