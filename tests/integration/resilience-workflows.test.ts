/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “resilience workflows.test” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { NextRequest, NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as uploadSignedLease } from "@/app/api/v1/admin/properties/[propertyId]/leases/[leaseId]/signed-document/route";
import type { StorageAdapter } from "@/lib/documents/storage";
import { createSession, sessionCookieName } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { enforceFileRetention } from "@/lib/server/file-retention";
import { listMeterReadings, recordMeterReadings } from "@/lib/server/meters";
import { requireSubscriptionFeature } from "@/lib/server/saas";
import { requireActiveSubscription } from "@/lib/server/subscription-guard";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let tenantUserId = "";
let planId = "";

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  const plan = await getDatabase().saasPlan.create({
    data: {
      code: `RESILIENCE_${fixture.suffix.toUpperCase()}`,
      name: "Resilience integration plan",
      monthlyPrice: 100,
      maxProperties: 2,
      maxRooms: 100,
      allowFileUploads: true,
    },
  });
  planId = plan.id;
  await getDatabase().propertySubscription.create({
    data: {
      propertyId: fixture.property.id,
      planId: plan.id,
      planName: plan.name,
      priceAmount: 100,
      status: "ACTIVE",
      maxProperties: 2,
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
    userIds: [
      tenantUserId,
      fixture.owner.id,
      fixture.otherOwner.id,
      fixture.superAdmin.id,
    ].filter(Boolean),
  });
  if (planId) await getDatabase().saasPlan.deleteMany({ where: { id: planId } });
  await getDatabase().$disconnect();
});

describe("retention, pagination and atomic workflow integration", () => {
  it("purges eligible slip and chat attachment metadata only after storage deletion succeeds", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const tenantUser = await getDatabase().user.create({
      data: {
        email: `retention-${fixture.suffix}@example.test`,
        passwordHash: fixture.owner.passwordHash,
        displayName: "Retention Tenant",
        role: "TENANT",
        approvalStatus: "APPROVED",
        tenantProfile: { create: { phone: "0899999999" } },
      },
      include: { tenantProfile: true },
    });
    tenantUserId = tenantUser.id;
    const invoice = await getDatabase().invoice.create({
      data: {
        propertyId: fixture.property.id,
        roomId: fixture.room.id,
        invoiceNumber: `RET-${fixture.suffix}`,
        billingMonth: new Date("2024-01-01T00:00:00.000Z"),
        status: "PAID",
        dueDate: new Date("2024-01-05T00:00:00.000Z"),
        subtotal: 100,
        total: 100,
      },
    });
    const reviewedAt = new Date("2024-01-10T00:00:00.000Z");
    const slip = await getDatabase().paymentSubmission.create({
      data: {
        propertyId: fixture.property.id,
        invoiceId: invoice.id,
        tenantProfileId: tenantUser.tenantProfile!.id,
        amount: 100,
        status: "APPROVED",
        reviewedAt,
        reviewedById: fixture.owner.id,
        slipStorageKey: `integration/${fixture.suffix}/old-slip.png`,
        slipMime: "image/png",
        slipSize: 128,
      },
    });
    const conversation = await getDatabase().chatConversation.create({
      data: {
        propertyId: fixture.property.id,
        conversationKey: `retention-${fixture.suffix}`,
        type: "PROPERTY_SUPPORT",
      },
    });
    const message = await getDatabase().chatMessage.create({
      data: {
        propertyId: fixture.property.id,
        conversationId: conversation.id,
        senderRole: "ADMIN",
        senderUserId: fixture.owner.id,
        body: "old attachment",
        clientId: `retention-${fixture.suffix}`,
        attachmentKey: `integration/${fixture.suffix}/old-chat.pdf`,
        attachmentName: "old-chat.pdf",
        attachmentMime: "application/pdf",
        attachmentSize: 256,
        createdAt: reviewedAt,
      },
    });
    const deleted: string[] = [];
    const storage: StorageAdapter = {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “delete” ตามกฎของระบบ
     * รับค่า:
     * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    async delete(key) { deleted.push(key); },
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get” แล้วส่งผลที่เหมาะสมกลับไป
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    async get() { throw new Error("not used"); },
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “put” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    async put() { throw new Error("not used"); },
    };

    const runAt = new Date("2026-01-15T00:00:00.000Z");
    const result = await enforceFileRetention(
      runAt,
      { slipDays: 365, documentDays: 2555, chatAttachmentDays: 365, batchSize: 100 },
      storage,
    );

    expect(result).toMatchObject({
      paymentSlipsPurged: 1,
      chatAttachmentsPurged: 1,
      failedFiles: 0,
    });
    expect(deleted).toEqual(expect.arrayContaining([
      `integration/${fixture.suffix}/old-slip.png`,
      `integration/${fixture.suffix}/old-chat.pdf`,
    ]));
    expect(await getDatabase().paymentSubmission.findUniqueOrThrow({ where: { id: slip.id } }))
      .toMatchObject({ slipStorageKey: null, slipMime: null, slipSize: null, slipPurgedAt: runAt });
    expect(await getDatabase().chatMessage.findUniqueOrThrow({ where: { id: message.id } }))
      .toMatchObject({
        attachmentKey: null,
        attachmentName: null,
        attachmentMime: null,
        attachmentSize: null,
        attachmentPurgedAt: runAt,
      });
  });

  it("paginates within property ownership and never leaks another property's rows", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    await recordMeterReadings(fixture.property.id, fixture.owner.id, [
      { roomId: fixture.room.id, type: "WATER", billingMonth: "2025-01", previousReading: 0, currentReading: 10 },
      { roomId: fixture.room.id, type: "WATER", billingMonth: "2025-02", currentReading: 20 },
      { roomId: fixture.room.id, type: "WATER", billingMonth: "2025-03", currentReading: 30 },
    ]);

    const first = await listMeterReadings(fixture.property.id, { page: 1, pageSize: 2 });
    const second = await listMeterReadings(fixture.property.id, { page: 2, pageSize: 2 });
    const foreign = await listMeterReadings(fixture.otherProperty.id, { page: 1, pageSize: 100 });

    expect(first.data).toHaveLength(2);
    expect(first.pageInfo).toEqual({ page: 1, pageSize: 2, hasNextPage: true });
    expect(second.data).toHaveLength(1);
    expect(second.pageInfo.hasNextPage).toBe(false);
    expect(new Set([...first.data, ...second.data].map(({ id }) => id)).size).toBe(3);
    expect(foreign.data).toEqual([]);
  });

  it("rolls back every meter row when one item in a bulk write is invalid", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const month = new Date("2025-04-01T00:00:00.000Z");
    await expect(recordMeterReadings(fixture.property.id, fixture.owner.id, [
      { roomId: fixture.room.id, type: "WATER", billingMonth: "2025-04", currentReading: 40 },
      { roomId: fixture.room.id, type: "ELECTRICITY", billingMonth: "2025-04", previousReading: 50, currentReading: 49 },
    ])).rejects.toMatchObject({ status: 400 });

    expect(await getDatabase().meterReading.count({
      where: { propertyId: fixture.property.id, billingMonth: month },
    })).toBe(0);
  });
});

describe("upload and subscription enforcement integration", () => {
  it("rejects cross-origin and forged PDF uploads before persisting a signed document", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const sessionResponse = NextResponse.json({ ok: true });
    await createSession(fixture.owner.id, sessionResponse);
    const token = sessionResponse.cookies.get(sessionCookieName)?.value;
    const context = {
      params: Promise.resolve({ propertyId: fixture.property.id, leaseId: fixture.room.id }),
    };
    const forged = new FormData();
    forged.set("file", new File(["not a pdf"], "lease.pdf", { type: "application/pdf" }));
    const forgedResponse = await uploadSignedLease(new NextRequest(
      `http://localhost/api/v1/admin/properties/${fixture.property.id}/leases/${fixture.room.id}/signed-document`,
      {
        method: "POST",
        headers: { origin: "http://localhost", cookie: `${sessionCookieName}=${token}` },
        body: forged,
      },
    ), context);
    expect(forgedResponse.status).toBe(415);

    const crossOrigin = new FormData();
    crossOrigin.set("file", new File(["%PDF-1.7"], "lease.pdf", { type: "application/pdf" }));
    const crossOriginResponse = await uploadSignedLease(new NextRequest(
      `http://localhost/api/v1/admin/properties/${fixture.property.id}/leases/${fixture.room.id}/signed-document`,
      {
        method: "POST",
        headers: { origin: "https://attacker.example", cookie: `${sessionCookieName}=${token}` },
        body: crossOrigin,
      },
    ), context);
    expect(crossOriginResponse.status).toBe(403);
    expect(await getDatabase().lease.count({
      where: { id: fixture.room.id, signedStorageKey: { not: null } },
    })).toBe(0);
  });

  it("allows the configured grace period and enforces read-only afterwards", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    await getDatabase().propertySubscription.update({
      where: { propertyId: fixture.property.id },
      data: {
        status: "ACTIVE",
        startsAt: new Date(Date.now() - 60 * 86_400_000),
        expiresAt: new Date(Date.now() - 1_000),
      },
    });

    await expect(requireSubscriptionFeature(fixture.property.id, "allowFileUploads"))
      .resolves.toBeDefined();

    await getDatabase().propertySubscription.update({
      where: { propertyId: fixture.property.id },
      data: { expiresAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    await expect(requireSubscriptionFeature(fixture.property.id, "allowFileUploads"))
      .rejects.toMatchObject({ status: 403 });
    expect((await getDatabase().propertySubscription.findUniqueOrThrow({
      where: { propertyId: fixture.property.id },
    })).status).toBe("ACTIVE");
  });

  it("denies access when the subscription record is missing", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    await getDatabase().propertySubscription.delete({
      where: { propertyId: fixture.property.id },
    });

    await expect(requireActiveSubscription(fixture.property.id))
      .rejects.toMatchObject({ status: 403 });
    await expect(requireSubscriptionFeature(fixture.property.id, "allowFileUploads"))
      .rejects.toMatchObject({ status: 403 });
  });
});
