/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “critical workflows.test” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ensureTenantConversation,
  listConversationMessages,
  sendConversationMessage,
} from "@/lib/server/chat";
import { getDatabase } from "@/lib/server/db";
import { getDashboardReadModel } from "@/lib/server/dashboard-read-model";
import { cancelInvoice, generateInvoice, issueInvoice, recalculateOverdueInvoices } from "@/lib/server/invoices";
import { attachSignedLease, createLease, getLease, renewLease, transitionLease, updateLease } from "@/lib/server/leases";
import { getMeterWorksheet, recordMeterReading } from "@/lib/server/meters";
import {
  createPaymentSubmission,
  getAdminSlip,
  getTenantPromptPay,
  reviewPaymentSubmission,
} from "@/lib/server/payments";
import {
  createAnnouncement,
  createParcel,
  createTenantTicket,
  createTicketReply,
  countUnreadTicketReplies,
  getTicketAttachment,
  listTicketReplies,
  listTenantAnnouncements,
  listTenantParcels,
  updateParcel,
  updateTicket,
  attachTicketFile,
} from "@/lib/server/property-operations";
import { acceptTenantInvitation, createInvitation, registerTenant, reviewOccupancy } from "@/lib/server/tenant-onboarding";
import { hashPassword } from "@/lib/server/password";
import { requireTenantOccupancy } from "@/lib/server/tenant-auth";
import { getTenantLease } from "@/lib/server/tenant-portal";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
const createdUserIds: string[] = [];

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  await getDatabase().propertySubscription.create({
    data: {
      propertyId: fixture.property.id,
      planName: "Critical workflow test",
      status: "ACTIVE",
      maxProperties: 1,
      maxRooms: 100,
      startsAt: new Date(Date.now() - 86_400_000),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [...createdUserIds, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id],
  });
  await getDatabase().$disconnect();
});

describe("critical property workflow integration", () => {
  it("lets an existing tenant account accept another invitation", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const user = await getDatabase().user.create({
      data: {
        email: `existing-tenant-${fixture.suffix}@example.test`,
        passwordHash: await hashPassword("Tenant-Password-123"),
        displayName: "Existing Tenant",
        role: "TENANT",
        approvalStatus: "APPROVED",
        tenantProfile: { create: { phone: "0822222222" } },
      },
      select: { id: true, tenantProfile: { select: { id: true } } },
    });
    createdUserIds.push(user.id);
    if (!user.tenantProfile) throw new Error("Tenant profile was not created");
    const room = await getDatabase().room.create({
      data: {
        propertyId: fixture.property.id,
        buildingId: fixture.building.id,
        floorId: fixture.floor.id,
        number: `B-${fixture.suffix}`,
        roomType: "Standard",
        monthlyRent: 3500,
        depositAmount: 7000,
        capacity: 2,
      },
    });
    const invitation = await createInvitation(fixture.property.id, fixture.owner.id, {
      roomId: room.id,
      intendedRole: "CO_OCCUPANT",
      expiresInDays: 7,
    });
    const occupancy = await acceptTenantInvitation(user.tenantProfile.id, {
      invitationCode: invitation.invitationCode,
    });
    expect(occupancy).toMatchObject({
      status: "PENDING",
      role: "CO_OCCUPANT",
      room: { number: room.number },
    });
    await expect(requireTenantOccupancy(user.tenantProfile.id, occupancy.id)).resolves.toMatchObject({
      id: occupancy.id,
      status: "PENDING",
    });
    await expect(requireTenantOccupancy("cm000000000000000000099", occupancy.id))
      .rejects.toMatchObject({ status: 404 });
    await expect(acceptTenantInvitation(user.tenantProfile.id, {
      invitationCode: invitation.invitationCode,
    })).rejects.toMatchObject({ status: 400 });
  });

  it("persists onboarding, contract versioning, meters, billing, PromptPay, slip review, and late fees", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    await getDatabase().$transaction([
      getDatabase().roomTypeConfig.create({
        data: {
          propertyId: fixture.property.id,
          name: "Standard",
          monthlyRent: 3500,
          depositAmount: 7000,
          capacity: 2,
        },
      }),
      getDatabase().serviceChargeConfig.create({
        data: {
          propertyId: fixture.property.id,
          name: "Internet",
          amount: 300,
          frequency: "monthly",
          calculation: "room",
        },
      }),
      getDatabase().furnitureOption.create({
        data: { propertyId: fixture.property.id, name: "Bed", isDefault: true },
      }),
    ]);
    const settingsProjection = (await getDashboardReadModel(fixture.property.id)).settings;
    expect(settingsProjection.roomTypes).toEqual([
      expect.objectContaining({ name: "Standard", rent: 3500, deposit: 7000, capacity: 2 }),
    ]);
    expect(settingsProjection.serviceCharges).toEqual([
      expect.objectContaining({ name: "Internet", amount: 300, frequency: "monthly", calculation: "room" }),
    ]);
    expect(settingsProjection.furnitureOptions).toEqual(["Bed"]);
    expect(settingsProjection.defaultFurniture).toEqual(["Bed"]);
    expect(settingsProjection.floorDirectory).toEqual([
      expect.objectContaining({ id: fixture.floor.id, buildingId: fixture.building.id, number: 1 }),
    ]);

    const invitation = await createInvitation(fixture.property.id, fixture.owner.id, {
      roomId: fixture.room.id, intendedRole: "PRIMARY", expiresInDays: 7,
    });
    const registration = await registerTenant({
      invitationCode: invitation.invitationCode,
      email: `tenant-${fixture.suffix}@example.test`,
      password: "Tenant-Password-123",
      displayName: "Integration Tenant",
      phone: "0811111111",
      termsAccepted: true,
      privacyAcknowledged: true,
      marketingConsent: false,
    });
    createdUserIds.push(registration.userId);
    expect(registration.occupancy.status).toBe("PENDING");

    const occupancy = await reviewOccupancy(
      fixture.property.id, registration.occupancy.id, fixture.owner.id, { status: "ACTIVE" },
    );
    expect(occupancy.status).toBe("ACTIVE");
    expect((await getDatabase().room.findUniqueOrThrow({ where: { id: fixture.room.id } })).status).toBe("OCCUPIED");

    const tenant = await getDatabase().tenantProfile.findUniqueOrThrow({ where: { userId: registration.userId } });
    const lease = await createLease(fixture.property.id, fixture.owner.id, {
      roomId: fixture.room.id,
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2027-06-30T00:00:00.000Z"),
      monthlyRent: 3500,
      depositAmount: 7000,
    });
    const versioned = await updateLease(fixture.property.id, lease.id, fixture.owner.id, {
      expectedVersion: 1, monthlyRent: 3600,
    });
    expect(versioned.currentVersion).toBe(2);
    expect(versioned.versions.map(({ version }) => version)).toEqual([2, 1]);
    await attachSignedLease(fixture.property.id, lease.id, `integration/${fixture.suffix}/lease.pdf`);
    const activeLease = await transitionLease(fixture.property.id, lease.id, {
      expectedVersion: 2, status: "ACTIVE",
    });
    expect(activeLease.status).toBe("ACTIVE");

    const renewedLease = await renewLease(fixture.property.id, lease.id, fixture.owner.id, {
      startDate: new Date("2027-07-01T00:00:00.000Z"),
      endDate: new Date("2028-06-30T00:00:00.000Z"),
      monthlyRent: 3800,
      depositAmount: 7000,
    });
    await attachSignedLease(fixture.property.id, renewedLease.id, `integration/${fixture.suffix}/renewed-lease.pdf`);
    const tenantLeases = await getTenantLease(tenant.id, fixture.room.id, "PRIMARY");
    expect(tenantLeases.current?.id).toBe(lease.id);
    expect(tenantLeases.current?.status).toBe("ACTIVE");
    expect(tenantLeases.upcoming?.id).toBe(renewedLease.id);
    expect(tenantLeases.upcoming?.status).toBe("PENDING_SIGNATURE");

    await recordMeterReading(fixture.property.id, fixture.owner.id, {
      roomId: fixture.room.id, type: "WATER", billingMonth: "2026-07",
      previousReading: 100, currentReading: 106,
    });
    await recordMeterReading(fixture.property.id, fixture.owner.id, {
      roomId: fixture.room.id, type: "ELECTRICITY", billingMonth: "2026-07",
      previousReading: 1000, currentReading: 1070,
    });
    const recordedWorksheet = await getMeterWorksheet(
      fixture.property.id,
      "2026-07",
      "WATER",
      { page: 1, pageSize: 50 },
    );
    expect(recordedWorksheet.data.find(({ room }) => room.id === fixture!.room.id))
      .toMatchObject({
        readingId: expect.any(String),
        previousReading: "100",
        currentReading: "106",
        unitRate: "18",
      });
    const nextWorksheet = await getMeterWorksheet(
      fixture.property.id,
      "2026-08",
      "WATER",
      { page: 1, pageSize: 50 },
    );
    expect(nextWorksheet.data.find(({ room }) => room.id === fixture!.room.id))
      .toMatchObject({
        readingId: null,
        previousReading: "106",
        currentReading: null,
        unitRate: "18",
      });
    const invoice = await generateInvoice(fixture.property.id, {
      roomId: fixture.room.id, billingMonth: "2026-07", issueImmediately: false,
    });
    expect(invoice.status).toBe("DRAFT");
    expect(invoice.items.map(({ type }) => type)).toEqual(["RENT", "WATER", "ELECTRICITY"]);
    expect(invoice.total).toBe("4198");

    const issuedInvoice = await issueInvoice(fixture.property.id, invoice.id, invoice.version);
    expect(issuedInvoice.status).toBe("PENDING");

    const promptPay = await getTenantPromptPay(tenant.id, issuedInvoice.id);
    expect(promptPay.amount).toBe("4198");
    expect(promptPay.payload).toMatch(/^000201/);

    const payment = await createPaymentSubmission({
      tenantProfileId: tenant.id, invoiceId: issuedInvoice.id,
      storageKey: `integration/${fixture.suffix}/slip.png`, mimeType: "image/png", size: 1024,
    });
    await expect(createPaymentSubmission({
      tenantProfileId: tenant.id, invoiceId: issuedInvoice.id,
      storageKey: "duplicate.png", mimeType: "image/png", size: 1024,
    })).rejects.toMatchObject({ status: 409 });
    expect((await getAdminSlip(fixture.property.id, payment.id)).slipStorageKey).toContain("slip.png");
    await expect(getAdminSlip(fixture.otherProperty.id, payment.id)).rejects.toMatchObject({ status: 404 });

    const reviewed = await reviewPaymentSubmission({
      propertyId: fixture.property.id, paymentId: payment.id, reviewerId: fixture.owner.id, status: "APPROVED",
    });
    expect(reviewed.status).toBe("APPROVED");
    expect((await getDatabase().invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID");

    const overdueInvoice = await getDatabase().invoice.create({
      data: {
        propertyId: fixture.property.id, roomId: fixture.room.id,
        invoiceNumber: `OVERDUE-${fixture.suffix}`, billingMonth: new Date("2026-08-01T00:00:00.000Z"),
        status: "PENDING", dueDate: new Date("2026-08-05T00:00:00.000Z"), subtotal: 1000, total: 1000,
      },
    });
    const recalculated = await recalculateOverdueInvoices(fixture.property.id, new Date("2026-08-20T00:00:00.000Z"));
    expect(recalculated.updated).toBe(1);
    const overdue = await getDatabase().invoice.findUniqueOrThrow({ where: { id: overdueInvoice.id } });
    expect(overdue.status).toBe("OVERDUE");
    expect(overdue.lateFee.toString()).toBe("200");
    const cancelled = await cancelInvoice(fixture.property.id, overdue.id, overdue.version, "สร้างบิลทดสอบผิดรอบ");
    expect(cancelled.status).toBe("CANCELLED");
    const persistedCancellation = await getDatabase().invoice.findUniqueOrThrow({ where: { id: overdue.id } });
    expect(persistedCancellation.cancellationNote).toBe("สร้างบิลทดสอบผิดรอบ");
    expect(persistedCancellation.cancelledAt).toBeInstanceOf(Date);
    await expect(cancelInvoice(fixture.property.id, invoice.id, 2, "ไม่ควรยกเลิกได้"))
      .rejects.toMatchObject({ status: 409 });

    await expect(getLease(fixture.otherProperty.id, lease.id)).rejects.toMatchObject({ status: 404 });
  });

  it("enforces ownership across announcements, parcels, tickets, attachments, and chat", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const occupancy = await getDatabase().roomOccupancy.findFirstOrThrow({
      where: { roomId: fixture.room.id, status: "ACTIVE" },
      include: { tenantProfile: { include: { user: true } } },
    });
    const tenant = occupancy.tenantProfile;

    const announcement = await createAnnouncement(fixture.property.id, fixture.owner.id, {
      title: "Water maintenance", content: "09:00-12:00", audience: "ROOM",
      roomIds: [fixture.room.id], status: "PUBLISHED",
    });
    const visibleAnnouncements = await listTenantAnnouncements(
      fixture.property.id, fixture.building.id, fixture.floor.id, fixture.room.id,
      { page: 1, pageSize: 50 },
    );
    expect(visibleAnnouncements.data.some(({ id }) => id === announcement.id)).toBe(true);

    const parcel = await createParcel(
      fixture.property.id, fixture.owner.id, {
        roomId: fixture.room.id, recipientTenantId: tenant.id, note: "Front desk",
      },
      `integration/${fixture.suffix}/parcel.jpg`,
    );
    expect((await listTenantParcels(tenant.id, fixture.room.id, { page: 1, pageSize: 50 })).data
      .some(({ id }) => id === parcel.id)).toBe(true);
    expect((await updateParcel(fixture.property.id, parcel.id, {
      status: "RECEIVED", receivedByTenantId: tenant.id,
    })).status).toBe("RECEIVED");
    await expect(updateParcel(fixture.otherProperty.id, parcel.id, { status: "CANCELLED" }))
      .rejects.toMatchObject({ status: 404 });

    const ticket = await createTenantTicket({
      propertyId: fixture.property.id, roomId: fixture.room.id,
      tenantProfileId: tenant.id, userId: tenant.userId,
      data: { type: "REPAIR", title: "Leaking pipe", detail: "Under the sink", priority: "URGENT", isAnonymous: false },
    });
    const attachment = await attachTicketFile(
      ticket.id, tenant.userId, `integration/${fixture.suffix}/ticket.jpg`, "ticket.jpg", "image/jpeg", 2048,
    );
    expect((await getTicketAttachment({
      attachmentId: attachment.id, ticketId: ticket.id, tenantProfileId: tenant.id,
    })).fileName).toBe("ticket.jpg");
    await expect(getTicketAttachment({
      attachmentId: attachment.id, ticketId: ticket.id, propertyId: fixture.otherProperty.id,
    })).rejects.toMatchObject({ status: 404 });
    const ownerReply = await createTicketReply({
      ticketId: ticket.id,
      propertyId: fixture.property.id,
      actorUserId: fixture.owner.id,
      data: { body: "We will inspect the pipe this afternoon." },
    });
    expect(ownerReply.body).toContain("inspect");
    expect(await countUnreadTicketReplies({
      viewerUserId: tenant.userId,
      tenantProfileId: tenant.id,
      incomingRoles: ["PROPERTY_ADMIN"],
    })).toBe(1);
    const tenantReplies = await listTicketReplies({
      ticketId: ticket.id,
      tenantProfileId: tenant.id,
      viewerUserId: tenant.userId,
      pagination: { page: 1, pageSize: 20 },
    });
    expect(tenantReplies.data).toHaveLength(1);
    expect(await countUnreadTicketReplies({
      viewerUserId: tenant.userId,
      tenantProfileId: tenant.id,
      incomingRoles: ["PROPERTY_ADMIN"],
    })).toBe(0);
    await createTicketReply({
      ticketId: ticket.id,
      tenantProfileId: tenant.id,
      actorUserId: tenant.userId,
      data: { body: "Thank you. The room is available after 13:00." },
    });
    expect(await countUnreadTicketReplies({
      viewerUserId: fixture.owner.id,
      propertyId: fixture.property.id,
      incomingRoles: ["TENANT"],
    })).toBe(1);
    await expect(createTicketReply({
      ticketId: ticket.id,
      propertyId: fixture.otherProperty.id,
      actorUserId: fixture.owner.id,
      data: { body: "This must not be accepted." },
    })).rejects.toMatchObject({ status: 404 });
    expect((await updateTicket(fixture.property.id, ticket.id, fixture.owner.id, { status: "ACKNOWLEDGED" })).status).toBe("ACKNOWLEDGED");
    expect((await updateTicket(fixture.property.id, ticket.id, fixture.owner.id, { status: "IN_PROGRESS" })).status).toBe("IN_PROGRESS");
    expect((await updateTicket(fixture.property.id, ticket.id, fixture.owner.id, { status: "RESOLVED" })).status).toBe("RESOLVED");
    await expect(updateTicket(fixture.property.id, ticket.id, fixture.owner.id, { status: "OPEN" }))
      .rejects.toMatchObject({ status: 409 });
    const events = await getDatabase().ticketEvent.findMany({
      where: { ticketId: ticket.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(events.map(({ type }) => type)).toEqual([
      "CREATED",
      "ATTACHMENT_ADDED",
      "REPLY_ADDED",
      "REPLY_ADDED",
      "STATUS_CHANGED",
      "STATUS_CHANGED",
      "STATUS_CHANGED",
    ]);
    expect(events.at(-1)).toMatchObject({ fromValue: "IN_PROGRESS", toValue: "RESOLVED" });

    const conversation = await ensureTenantConversation({
      propertyId: fixture.property.id, tenantProfileId: tenant.id,
      tenantName: tenant.user.displayName, roomNumber: fixture.room.number,
    });
    const tenantActor = {
      role: "TENANT" as const, userId: tenant.userId,
      propertyId: fixture.property.id, tenantProfileId: tenant.id,
    };
    const first = await sendConversationMessage({
      conversationId: conversation.id, actor: tenantActor,
      body: "Please repair the pipe", clientId: `client-${fixture.suffix}`,
    });
    const duplicate = await sendConversationMessage({
      conversationId: conversation.id, actor: tenantActor,
      body: "This duplicate must not be inserted", clientId: `client-${fixture.suffix}`,
    });
    expect(duplicate.id).toBe(first.id);
    expect(await getDatabase().chatMessage.count({ where: { conversationId: conversation.id } })).toBe(1);

    await expect(sendConversationMessage({
      conversationId: conversation.id,
      actor: { role: "PROPERTY_ADMIN", userId: fixture.otherOwner.id, propertyId: fixture.otherProperty.id },
      body: "Unauthorized", clientId: `foreign-${fixture.suffix}`,
    })).rejects.toMatchObject({ status: 404 });
  });

  it("paginates more than 50 chat messages without gaps when timestamps are identical", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const conversation = await getDatabase().chatConversation.create({
      data: {
        propertyId: fixture.property.id,
        conversationKey: `PAGINATION:${fixture.suffix}`,
        type: "PROPERTY_SUPPORT",
      },
    });
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    await getDatabase().chatMessage.createMany({
      data: Array.from({ length: 61 }, (_, index) => ({
        propertyId: fixture!.property.id,
        conversationId: conversation.id,
        senderRole: "ADMIN" as const,
        senderUserId: fixture!.owner.id,
        body: `message-${String(index).padStart(2, "0")}`,
        clientId: `pagination-${fixture!.suffix}-${index}`,
        createdAt,
      })),
    });
    const actor = {
      role: "PROPERTY_ADMIN" as const,
      userId: fixture.owner.id,
      propertyId: fixture.property.id,
    };
    const newest = await listConversationMessages(conversation.id, actor, { limit: 50 });
    expect(newest.messages).toHaveLength(50);
    expect(newest.hasMore).toBe(true);

    const older = await listConversationMessages(conversation.id, actor, {
      beforeMessageId: newest.messages[0].id,
      limit: 50,
    });
    expect(older.messages).toHaveLength(11);
    expect(older.hasMore).toBe(false);
    expect(new Set([...older.messages, ...newest.messages].map(({ id }) => id)).size).toBe(61);
  });
});
