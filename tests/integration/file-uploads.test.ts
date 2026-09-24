import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as uploadParcelPhoto } from "@/app/api/v1/admin/properties/[propertyId]/parcels/route";
import { POST as uploadPaymentSlip } from "@/app/api/v1/tenant/invoices/[invoiceId]/payment-submissions/route";
import { POST as uploadTicketFile } from "@/app/api/v1/tenant/tickets/[ticketId]/attachments/route";
import { POST as uploadChatFile } from "@/app/api/v1/chat/conversations/[conversationId]/attachments/route";
import { createSession, sessionCookieName } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ensureTenantConversation } from "@/lib/server/chat";
import { generateInvoice, issueInvoice } from "@/lib/server/invoices";
import { recordMeterReading } from "@/lib/server/meters";
import { createTenantTicket } from "@/lib/server/property-operations";
import { createInvitation, registerTenant, reviewOccupancy } from "@/lib/server/tenant-onboarding";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let ownerCookie = "";
let tenantCookie = "";
let tenantProfileId = "";
let tenantUserId = "";
let invoiceId = "";
let ticketId = "";
let conversationId = "";
let planId = "";
// เก็บ key ของไฟล์ที่เทสต์เขียนจริงไว้ลบตอนจบ ฐานทดสอบกับดิสก์จะได้ไม่มีของค้าง
const storedKeys: string[] = [];

// ไบต์เปิดหัวของแต่ละรูปแบบ ใช้สร้างไฟล์ที่ "จริง" ในสายตาของตัวตรวจลายเซ็น
const pngBytes = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const jpgBytes = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70]);
const pdfBytes = () => new TextEncoder().encode("%PDF-1.7\nfake body");

function fileOf(bytes: Uint8Array, name: string, type: string) {
  return new File([bytes as unknown as BlobPart], name, { type });
}

function uploadRequest(url: string, form: FormData, cookie: string, extra: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    headers: { origin: "http://localhost", cookie: `${sessionCookieName}=${cookie}`, ...extra },
    body: form,
  });
}

async function sessionCookieFor(userId: string) {
  const response = NextResponse.json({ ok: true });
  await createSession(userId, response);
  const token = response.cookies.get(sessionCookieName)?.value;
  if (!token) throw new Error("Failed to create a session for the integration test");
  return token;
}

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  // ทุกเส้นทางอัปโหลดผ่านด่านแพ็กเกจก่อน สิทธิ์แนบไฟล์อยู่ที่แพ็กเกจ ไม่ใช่ที่ตัวการสมัคร
  const plan = await getDatabase().saasPlan.create({
    data: {
      code: `UPLOAD_${fixture.suffix.toUpperCase()}`,
      name: "Upload test plan",
      monthlyPrice: 990,
      maxProperties: 1,
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
      status: "ACTIVE",
      maxProperties: 1,
      maxRooms: 100,
      startsAt: new Date(Date.now() - 86_400_000),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });

  const invitation = await createInvitation(fixture.property.id, fixture.owner.id, {
    roomId: fixture.room.id, intendedRole: "PRIMARY", expiresInDays: 7,
  });
  const registration = await registerTenant({
    invitationCode: invitation.invitationCode,
    email: `upload-tenant-${fixture.suffix}@example.test`,
    password: "Tenant-Password-123",
    displayName: "Upload Tenant",
    phone: "0812223333",
    termsAccepted: true,
    privacyAcknowledged: true,
    marketingConsent: false,
  });
  tenantUserId = registration.userId;
  await reviewOccupancy(fixture.property.id, registration.occupancy.id, fixture.owner.id, { status: "ACTIVE" });
  const profile = await getDatabase().tenantProfile.findUniqueOrThrow({ where: { userId: registration.userId } });
  tenantProfileId = profile.id;

  // หอนี้ตั้งอัตราค่าน้ำค่าไฟไว้ จึงต้องจดมิเตอร์ก่อนถึงจะออกบิลได้
  await recordMeterReading(fixture.property.id, fixture.owner.id, {
    roomId: fixture.room.id, type: "WATER", billingMonth: "2026-08",
    previousReading: 100, currentReading: 106,
  });
  await recordMeterReading(fixture.property.id, fixture.owner.id, {
    roomId: fixture.room.id, type: "ELECTRICITY", billingMonth: "2026-08",
    previousReading: 1000, currentReading: 1070,
  });

  // บิลต้องออกแล้วเท่านั้นถึงส่งสลิปได้ ฉบับร่างยังไม่ถึงมือผู้เช่า
  const draft = await generateInvoice(fixture.property.id, {
    roomId: fixture.room.id, billingMonth: "2026-08", issueImmediately: false,
  });
  invoiceId = (await issueInvoice(fixture.property.id, draft.id, draft.version)).id;

  const ticket = await createTenantTicket({
    propertyId: fixture.property.id, roomId: fixture.room.id,
    tenantProfileId, userId: tenantUserId,
    data: { type: "REPAIR", title: "Broken lock", detail: "Front door", priority: "NORMAL", isAnonymous: false },
  });
  ticketId = ticket.id;

  const conversation = await ensureTenantConversation({
    propertyId: fixture.property.id, tenantProfileId,
    tenantName: "Upload Tenant", roomNumber: fixture.room.number,
  });
  conversationId = conversation.id;

  [ownerCookie, tenantCookie] = await Promise.all([
    sessionCookieFor(fixture.owner.id),
    sessionCookieFor(tenantUserId),
  ]);
});

afterAll(async () => {
  // ลบไฟล์ที่เขียนจริงก่อน เพราะพวกนี้อยู่นอกฐานข้อมูล cleanup ของ fixture จึงตามไปลบให้ไม่ได้
  await Promise.all(storedKeys.map((key) => getStorageAdapter().delete(key).catch(() => undefined)));
  if (fixture) {
    await cleanupIntegrationFixture({
      propertyIds: [fixture.property.id, fixture.otherProperty.id],
      userIds: [tenantUserId, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id].filter(Boolean),
    });
  }
  if (planId) await getDatabase().saasPlan.deleteMany({ where: { id: planId } });
  // ตัวนับโควตาเก็บเป็น hash จึงกรองตามเส้นทางไม่ได้ ล้างทั้งตารางไปเลย
  // เพราะรันซ้ำภายในสิบนาทีจะไปชนเพดานอัปโหลดของรอบก่อน
  await getDatabase().apiRateLimit.deleteMany({});
  await getDatabase().$disconnect();
});

describe("file upload route integration", () => {
  // ด่านสำคัญที่สุดของทุกเส้นทางอัปโหลด ชนิดไฟล์ต้องดูจากไบต์จริง ไม่ใช่จากชื่อหรือ Content-Type
  it("รับรูปพัสดุที่เป็น PNG จริง และปฏิเสธไฟล์ที่ปลอมนามสกุลมา", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const context = { params: Promise.resolve({ propertyId: fixture.property.id }) };
    const url = `http://localhost/api/v1/admin/properties/${fixture.property.id}/parcels`;

    const good = new FormData();
    good.set("roomId", fixture.room.id);
    good.set("note", "กล่องใหญ่");
    good.set("file", fileOf(pngBytes(), "parcel.png", "image/png"));
    const created = await uploadParcelPhoto(uploadRequest(url, good, ownerCookie), context);
    expect(created.status).toBe(201);
    // ชื่อไฟล์บนที่เก็บต้องเป็นค่าที่เซิร์ฟเวอร์สุ่มเอง ไม่ใช่ชื่อที่ผู้ใช้ส่งมา
    const parcel = await getDatabase().parcel.findFirstOrThrow({
      where: { propertyId: fixture.property.id }, orderBy: { registeredAt: "desc" },
    });
    if (parcel.imageStorageKey) storedKeys.push(parcel.imageStorageKey);
    expect(parcel.imageStorageKey).toMatch(/^parcels\/.+\/[0-9a-f-]{36}\.png$/);
    expect(parcel.imageStorageKey).not.toContain("parcel.png");

    // สคริปต์ที่เปลี่ยนนามสกุลเป็น .png และแจ้ง Content-Type เป็นรูป ต้องไม่ผ่าน
    const forged = new FormData();
    forged.set("roomId", fixture.room.id);
    forged.set("file", fileOf(new TextEncoder().encode("<?php system($_GET[0]); ?>"), "shell.png", "image/png"));
    const forgedResponse = await uploadParcelPhoto(uploadRequest(url, forged, ownerCookie), context);
    expect(forgedResponse.status).toBe(415);
  });

  // แต่ละเส้นทางมี allowlist ของตัวเอง รูปพัสดุรับแค่รูปภาพ ไม่รับ PDF แม้จะเป็นไฟล์ที่ถูกต้อง
  it("ปฏิเสธ PDF ที่ถูกต้องในเส้นทางที่รับเฉพาะรูปภาพ", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const form = new FormData();
    form.set("roomId", fixture.room.id);
    form.set("file", fileOf(pdfBytes(), "parcel.pdf", "application/pdf"));
    const response = await uploadParcelPhoto(
      uploadRequest(`http://localhost/api/v1/admin/properties/${fixture.property.id}/parcels`, form, ownerCookie),
      { params: Promise.resolve({ propertyId: fixture.property.id }) },
    );
    expect(response.status).toBe(415);
    // ต้องถูกปฏิเสธก่อนแตะฐานข้อมูล ไม่ใช่สร้างแถวแล้วค่อยย้อน
    expect(await getDatabase().parcel.count({ where: { propertyId: fixture.property.id, note: "pdf" } })).toBe(0);
  });

  // คำขอจากเว็บอื่นต้องถูกปัดตกตั้งแต่ต้น ไม่ว่าไฟล์จะถูกต้องแค่ไหน
  it("ปฏิเสธการอัปโหลดข้ามโดเมนก่อนอ่านไฟล์", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const form = new FormData();
    form.set("roomId", fixture.room.id);
    form.set("file", fileOf(pngBytes(), "parcel.png", "image/png"));
    const response = await uploadParcelPhoto(new NextRequest(
      `http://localhost/api/v1/admin/properties/${fixture.property.id}/parcels`,
      {
        method: "POST",
        headers: { origin: "https://attacker.example", cookie: `${sessionCookieName}=${ownerCookie}` },
        body: form,
      },
    ), { params: Promise.resolve({ propertyId: fixture.property.id }) });
    expect(response.status).toBe(403);
  });

  // สลิปโอนเงินรับทั้งรูปถ่ายและ PDF ที่ธนาคารออกให้
  it("รับสลิปเป็น PDF และบันทึกชนิดไฟล์ตามไบต์จริง", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const form = new FormData();
    // ตั้งใจแจ้ง Content-Type เป็น JPEG ทั้งที่เนื้อในเป็น PDF ระบบต้องเชื่อเนื้อใน
    form.set("file", fileOf(pdfBytes(), "slip.jpg", "image/jpeg"));
    const response = await uploadPaymentSlip(
      uploadRequest(`http://localhost/api/v1/tenant/invoices/${invoiceId}/payment-submissions`, form, tenantCookie),
      { params: Promise.resolve({ invoiceId }) },
    );
    expect(response.status).toBe(201);
    const submission = await getDatabase().paymentSubmission.findFirstOrThrow({
      where: { invoiceId }, orderBy: { submittedAt: "desc" },
    });
    if (submission.slipStorageKey) storedKeys.push(submission.slipStorageKey);
    expect(submission.slipMime).toBe("application/pdf");
    expect(submission.slipStorageKey).toMatch(/\.pdf$/);
    // ไฟล์ต้องถูกเขียนลงที่เก็บจริง ไม่ใช่บันทึกแต่แถวในฐานข้อมูล
    expect((await getStorageAdapter().get(submission.slipStorageKey!)).size).toBeGreaterThan(0);
  });

  // ไฟล์ใหญ่เกินต้องถูกปัดตกด้วย 413 ก่อนอ่านเนื้อไฟล์ทั้งก้อนเข้าหน่วยความจำ
  it("ปฏิเสธไฟล์ที่ใหญ่เกิน 5 MB", async () => {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    oversized.set(pngBytes());
    const form = new FormData();
    form.set("file", fileOf(oversized, "huge.png", "image/png"));
    const response = await uploadPaymentSlip(
      uploadRequest(`http://localhost/api/v1/tenant/invoices/${invoiceId}/payment-submissions`, form, tenantCookie),
      { params: Promise.resolve({ invoiceId }) },
    );
    expect(response.status).toBe(413);
  });

  // ไฟล์แนบในเรื่องแจ้งรับ PNG, JPG และ PDF
  it("รับไฟล์แนบของเรื่องแจ้งและตั้งชื่อไฟล์บนที่เก็บเอง", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const form = new FormData();
    form.set("file", fileOf(jpgBytes(), "../../escape.jpg", "image/jpeg"));
    const response = await uploadTicketFile(
      uploadRequest(`http://localhost/api/v1/tenant/tickets/${ticketId}/attachments`, form, tenantCookie),
      { params: Promise.resolve({ ticketId }) },
    );
    expect(response.status).toBe(201);
    const attachment = await getDatabase().ticketAttachment.findFirstOrThrow({
      where: { ticketId }, orderBy: { createdAt: "desc" },
    });
    storedKeys.push(attachment.storageKey);
    // ชื่อที่ผู้ใช้ส่งมามีจุดสองจุดไต่ขึ้นโฟลเดอร์ แต่ชื่อบนที่เก็บสร้างเองจึงไม่ได้รับผลกระทบ
    expect(attachment.storageKey).not.toContain("..");
    expect(attachment.storageKey).toMatch(new RegExp(`^tickets/${fixture.property.id}/${ticketId}/[0-9a-f-]{36}\\.jpg$`));
    expect(attachment.mimeType).toBe("image/jpeg");
  });

  // แชทรับ WebP ได้ด้วย ต่างจากเส้นทางอื่น จึงต้องยืนยันว่า allowlist กว้างกว่าจริง
  it("รับไฟล์แนบในแชทเป็น WebP และล้างชื่อไฟล์ที่ผู้ใช้ส่งมา", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const webp = new Uint8Array(16);
    webp.set(new TextEncoder().encode("RIFF"), 0);
    webp.set(new TextEncoder().encode("WEBP"), 8);
    const form = new FormData();
    form.set("propertyId", fixture.property.id);
    form.set("body", "ส่งรูปให้ดูครับ");
    form.set("clientId", randomUUID());
    form.set("file", fileOf(webp, "<script>.webp", "image/webp"));
    const response = await uploadChatFile(
      uploadRequest(
        `http://localhost/api/v1/chat/conversations/${conversationId}/attachments`,
        form,
        tenantCookie,
        { "x-property-id": fixture.property.id },
      ),
      { params: Promise.resolve({ conversationId }) },
    );
    expect(response.status).toBe(201);
    const message = await getDatabase().chatMessage.findFirstOrThrow({
      where: { conversationId, attachmentKey: { not: null } }, orderBy: { createdAt: "desc" },
    });
    if (message.attachmentKey) storedKeys.push(message.attachmentKey);
    expect(message.attachmentMime).toBe("image/webp");
    expect(message.attachmentKey).toMatch(/\.webp$/);
    // ชื่อที่โชว์ให้ผู้ใช้เห็นต้องถูกล้างอักขระที่ใช้แทรกสคริปต์ออกไปแล้ว
    expect(message.attachmentName).not.toContain("<");
    expect(message.attachmentName).not.toContain(">");
  });

  // ไฟล์ที่ไม่ใช่ชนิดใดเลยในรายการต้องไม่ถูกเก็บ และต้องไม่มีข้อความค้างในแชท
  it("ไม่บันทึกข้อความเมื่อไฟล์แนบในแชทเป็นชนิดที่ไม่รองรับ", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const before = await getDatabase().chatMessage.count({ where: { conversationId } });
    const form = new FormData();
    form.set("propertyId", fixture.property.id);
    form.set("body", "ไฟล์แปลก");
    form.set("clientId", randomUUID());
    form.set("file", fileOf(new TextEncoder().encode("MZ\u0090\u0000"), "tool.exe", "application/octet-stream"));
    const response = await uploadChatFile(
      uploadRequest(
        `http://localhost/api/v1/chat/conversations/${conversationId}/attachments`,
        form,
        tenantCookie,
        { "x-property-id": fixture.property.id },
      ),
      { params: Promise.resolve({ conversationId }) },
    );
    expect(response.status).toBe(415);
    expect(await getDatabase().chatMessage.count({ where: { conversationId } })).toBe(before);
  });
});
