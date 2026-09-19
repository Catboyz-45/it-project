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

// เตรียมหอที่มีแพ็กเกจใช้งานอยู่ เทสต์ในไฟล์นี้ต้องมีสมาชิกที่ยังไม่หมดอายุเป็นจุดตั้งต้น
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
  // ต้องลบไฟล์ในที่เก็บสำเร็จก่อน ค่อยล้างข้อมูลในฐานข้อมูล ไม่งั้นจะเหลือไฟล์ขยะที่ไม่มีใครรู้ว่ามีอยู่
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
    // ตั้งวันที่ไว้ปี 2024 ส่วนงานจะรันปี 2026 ของพวกนี้จึงเกินอายุเก็บ 365 วันไปแล้ว
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
    // ที่เก็บไฟล์ปลอม แค่จดว่าถูกสั่งลบอะไรบ้าง ไม่ได้แตะไฟล์จริง
    const deleted: string[] = [];
    const storage: StorageAdapter = {
      async delete(key) { deleted.push(key); },
      // สองตัวนี้งานล้างไฟล์ไม่เรียก โยน error ไว้ จะได้รู้ทันทีถ้าวันหนึ่งมีคนมาเรียก
      async get() { throw new Error("not used"); },
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
    // เช็คว่าสั่งลบไฟล์จริงทั้งสองไฟล์ ไม่ใช่แค่ล้างข้อมูลในฐานข้อมูลแล้วทิ้งไฟล์ค้างไว้
    expect(deleted).toEqual(expect.arrayContaining([
      `integration/${fixture.suffix}/old-slip.png`,
      `integration/${fixture.suffix}/old-chat.pdf`,
    ]));
    // แถวยังอยู่ ลบเฉพาะข้อมูลของไฟล์ แล้วติดวันที่ล้างไว้ ประวัติการชำระจึงยังตรวจสอบได้
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

  // แบ่งหน้าต้องไม่หลุดข้อมูลข้ามหอ ขอหน้าไหนก็ได้เฉพาะของหอตัวเอง
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
    // สามแถวแบ่งหน้าละสอง หน้าแรกต้องบอกว่ามีหน้าถัดไป หน้าสองต้องบอกว่าหมดแล้ว
    expect(first.pageInfo).toEqual({ page: 1, pageSize: 2, hasNextPage: true });
    expect(second.data).toHaveLength(1);
    expect(second.pageInfo.hasNextPage).toBe(false);
    // รวมสองหน้าแล้วต้องได้ครบสามแถวไม่ซ้ำ พิสูจน์ว่าไม่มีแถวตกหล่นหรือโผล่ซ้ำตอนข้ามหน้า
    expect(new Set([...first.data, ...second.data].map(({ id }) => id)).size).toBe(3);
    // ถามหอของคนอื่นต้องได้อาร์เรย์ว่าง ไม่ใช่ข้อมูลของหอเรา
    expect(foreign.data).toEqual([]);
  });

  // บันทึกมิเตอร์ทีละหลายห้อง ถ้ามีห้องหนึ่งข้อมูลผิด ต้องไม่บันทึกห้องไหนเลย
  it("rolls back every meter row when one item in a bulk write is invalid", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const month = new Date("2025-04-01T00:00:00.000Z");
    await expect(recordMeterReadings(fixture.property.id, fixture.owner.id, [
      { roomId: fixture.room.id, type: "WATER", billingMonth: "2025-04", currentReading: 40 },
      // ตัวที่สองเลขใหม่น้อยกว่าเลขเก่า ซึ่งเป็นไปไม่ได้ จึงถูกปฏิเสธ
      { roomId: fixture.room.id, type: "ELECTRICITY", billingMonth: "2025-04", previousReading: 50, currentReading: 49 },
    ])).rejects.toMatchObject({ status: 400 });

    expect(await getDatabase().meterReading.count({
      where: { propertyId: fixture.property.id, billingMonth: month },
    // ต้องได้ 0 ตัวแรกที่ถูกต้องก็ต้องถูกย้อนคืนไปด้วย ไม่ใช่บันทึกไปครึ่งเดียว
    })).toBe(0);
  });
});

describe("upload and subscription enforcement integration", () => {
  // สองด่านของการอัปโหลด ชนิดไฟล์ปลอมและคำขอจากเว็บอื่น ต้องถูกปฏิเสธก่อนแตะฐานข้อมูล
  it("rejects cross-origin and forged PDF uploads before persisting a signed document", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const sessionResponse = NextResponse.json({ ok: true });
    await createSession(fixture.owner.id, sessionResponse);
    const token = sessionResponse.cookies.get(sessionCookieName)?.value;
    const context = {
      params: Promise.resolve({ propertyId: fixture.property.id, leaseId: fixture.room.id }),
    };
    const forged = new FormData();
    // นามสกุลกับ Content-Type บอกว่าเป็น PDF แต่เนื้อในไม่ใช่ ระบบต้องดูเนื้อไฟล์จริง ไม่เชื่อสิ่งที่เบราว์เซอร์บอก
    forged.set("file", new File(["not a pdf"], "lease.pdf", { type: "application/pdf" }));
    const forgedResponse = await uploadSignedLease(new NextRequest(
      `http://localhost/api/v1/admin/properties/${fixture.property.id}/leases/${fixture.room.id}/signed-document`,
      {
        method: "POST",
        headers: { origin: "http://localhost", cookie: `${sessionCookieName}=${token}` },
        body: forged,
      },
    ), context);
    // 415 คือชนิดไฟล์ไม่รองรับ
    expect(forgedResponse.status).toBe(415);

    const crossOrigin = new FormData();
    // คราวนี้เป็น PDF จริง แต่ส่งมาจากเว็บอื่น ต้องโดนปฏิเสธเพราะ origin ไม่ตรง
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
    // ยืนยันว่าทั้งสองกรณีไม่มีอะไรถูกเขียนลงฐานข้อมูลเลย
    expect(await getDatabase().lease.count({
      where: { id: fixture.room.id, signedStorageKey: { not: null } },
    })).toBe(0);
  });

  // หมดอายุแล้วยังมีช่วงผ่อนผันให้ใช้ได้ต่ออีกพัก พ้นช่วงนั้นถึงจะเหลือแค่อ่าน
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
      // ดันวันหมดอายุไป 8 วันที่แล้ว ซึ่งเกินช่วงผ่อนผัน 7 วัน
      data: { expiresAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    await expect(requireSubscriptionFeature(fixture.property.id, "allowFileUploads"))
      .rejects.toMatchObject({ status: 403 });
    expect((await getDatabase().propertySubscription.findUniqueOrThrow({
      where: { propertyId: fixture.property.id },
    // สถานะในฐานข้อมูลยังเป็น ACTIVE อยู่ การตัดสินว่าหมดอายุคำนวณจากวันที่ตอนใช้งาน ไม่ได้ไปเขียนทับแถว
    })).status).toBe("ACTIVE");
  });

  // ไม่มีข้อมูลแพ็กเกจเลยต้องปฏิเสธ ไม่ใช่ปล่อยผ่านเพราะหาเงื่อนไขที่ห้ามไม่เจอ ปฏิเสธไว้ก่อนเป็นค่าเริ่มต้น
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
