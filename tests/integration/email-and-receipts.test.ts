import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getPropertyReceiptData, getTenantReceiptData } from "@/lib/documents/receipt-data";
import { getDatabase } from "@/lib/server/db";
import { generateInvoice, issueInvoice } from "@/lib/server/invoices";
import { recordMeterReading } from "@/lib/server/meters";
import { sendSubscriptionExpiryReminders } from "@/lib/server/subscription-reminders";
import { createInvitation } from "@/lib/server/tenant-onboarding";
import { createWorkspaceFixture } from "./helpers";
import { callApi } from "./route-client";

// อีเมลคำเชิญ อีเมลเตือนแพ็กเกจใกล้หมดอายุ และใบเสร็จรับเงิน
// ไม่ได้ยิงไปที่ Resend จริง ดักคำขอไว้ด้วย fetch จำลอง แล้วตรวจว่าส่งอะไรไปหาใคร

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
const emailEnv = { RESEND_API_KEY: "test-key", PASSWORD_RESET_EMAIL_FROM: "Nestly <no-reply@example.test>", APP_URL: "https://app.example.test" };
const savedEnv: Record<string, string | undefined> = {};

// เปิดการส่งอีเมลชั่วคราวแล้วดักคำขอที่ออกไป คืนรายการคำขอที่ยิงไปที่ Resend
function captureEmails(ok = true) {
  for (const [key, value] of Object.entries(emailEnv)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  const sent: Array<{ to: string[]; subject: string; text: string }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input) !== "https://api.resend.com/emails") throw new Error(`Unexpected request: ${String(input)}`);
    sent.push(JSON.parse(String(init?.body)));
    return new Response(ok ? "{}" : "{\"error\":\"down\"}", { status: ok ? 200 : 500 });
  });
  return sent;
}

beforeAll(async () => {
  w = await createWorkspaceFixture("EMAIL_RECEIPTS");
}, 60_000);

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of Object.keys(emailEnv)) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

afterAll(async () => {
  if (!w) return;
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("tenant invitation email", () => {
  it("does not try to send when no email is given or the service is not configured", async () => {
    const plain = await createInvitation(w.property.id, w.owner.id, { roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 3 });
    expect(plain.emailStatus).toBe("not_requested");
    const unconfigured = await createInvitation(w.property.id, w.owner.id, { roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 3, email: "friend@example.test" });
    expect(unconfigured.emailStatus).toBe("skipped");
  });

  it("emails a register link that carries the code after # instead of in the query string", async () => {
    const sent = captureEmails();
    const created = await callApi("POST", `/api/v1/admin/properties/${w.property.id}/invitations`, {
      cookie: w.cookies.owner,
      body: { roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 3, email: "Friend@Example.test" },
    });
    expect(created.status).toBe(201);
    expect(created.json.data.emailStatus).toBe("sent");
    expect(sent).toHaveLength(1);
    // อีเมลถูกแปลงเป็นตัวเล็กก่อนส่ง และรหัสอยู่หลัง # เบราว์เซอร์จึงไม่ส่งรหัสไปที่เซิร์ฟเวอร์
    expect(sent[0].to).toEqual(["friend@example.test"]);
    expect(sent[0].text).toContain(`https://app.example.test/register#code=${encodeURIComponent(created.json.data.invitationCode)}`);
    expect(sent[0].text).not.toContain("?code=");
    // อีเมลที่ใส่มาต้องไม่ถูกเก็บลงฐานข้อมูล
    const stored = await getDatabase().tenantInvitation.findUniqueOrThrow({ where: { id: created.json.data.invitation.id } });
    expect(JSON.stringify(stored)).not.toContain("friend@example.test");
  });

  it("still creates the invitation when the email provider fails", async () => {
    captureEmails(false);
    const created = await callApi("POST", `/api/v1/admin/properties/${w.property.id}/invitations`, {
      cookie: w.cookies.owner,
      body: { roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 3, email: "friend@example.test" },
    });
    expect(created.status).toBe(201);
    expect(created.json.data.emailStatus).toBe("failed");
    expect(created.json.data.invitationCode.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects an invalid email", async () => {
    const created = await callApi("POST", `/api/v1/admin/properties/${w.property.id}/invitations`, {
      cookie: w.cookies.owner,
      body: { roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 3, email: "not-an-email" },
    });
    expect(created.status).toBe(400);
  });
});

describe("subscription expiry reminder", () => {
  const ownerReminders = (sent: Array<{ to: string[]; text: string }>) => sent.filter((email) => email.to.includes(w.owner.email));

  it("emails the owner once per expiry date and again after renewal", async () => {
    const runAt = new Date();
    const expiresAt = new Date(runAt.getTime() + 3 * 86_400_000);
    await getDatabase().propertySubscription.update({ where: { propertyId: w.property.id }, data: { expiresAt, expiryReminderSentFor: null } });

    // ยังไม่ได้ตั้งค่าบริการอีเมล ต้องไม่บันทึกว่าส่งแล้ว ตั้งค่าเมื่อไหร่จะได้ส่งจริง
    await sendSubscriptionExpiryReminders(runAt);
    expect((await getDatabase().propertySubscription.findUniqueOrThrow({ where: { propertyId: w.property.id } })).expiryReminderSentFor).toBeNull();

    const sent = captureEmails();
    await sendSubscriptionExpiryReminders(runAt);
    expect(ownerReminders(sent)).toHaveLength(1);
    expect(ownerReminders(sent)[0].text).toContain(`/admin/properties/${w.property.id}/subscription`);
    // รอบถัดไปของงานเบื้องหลังต้องไม่ส่งซ้ำ
    await sendSubscriptionExpiryReminders(runAt);
    expect(ownerReminders(sent)).toHaveLength(1);

    // ต่ออายุแล้ววันหมดอายุเปลี่ยน เมื่อเข้าช่วง 7 วันอีกครั้งต้องเตือนใหม่ได้
    const renewedExpiry = new Date(runAt.getTime() + 5 * 86_400_000);
    await getDatabase().propertySubscription.update({ where: { propertyId: w.property.id }, data: { expiresAt: renewedExpiry } });
    await sendSubscriptionExpiryReminders(runAt);
    expect(ownerReminders(sent)).toHaveLength(2);
  });

  it("does not remind about a plan that is still far from expiring, and retries after a failed send", async () => {
    const runAt = new Date();
    await getDatabase().propertySubscription.update({
      where: { propertyId: w.property.id },
      data: { expiresAt: new Date(runAt.getTime() + 20 * 86_400_000), expiryReminderSentFor: null },
    });
    const sent = captureEmails();
    await sendSubscriptionExpiryReminders(runAt);
    expect(ownerReminders(sent)).toHaveLength(0);
    vi.restoreAllMocks();

    const expiresAt = new Date(runAt.getTime() + 2 * 86_400_000);
    await getDatabase().propertySubscription.update({ where: { propertyId: w.property.id }, data: { expiresAt } });
    captureEmails(false);
    await sendSubscriptionExpiryReminders(runAt);
    // ส่งไม่ผ่านต้องคืนค่า รอบหน้าจะได้ลองใหม่
    expect((await getDatabase().propertySubscription.findUniqueOrThrow({ where: { propertyId: w.property.id } })).expiryReminderSentFor).toBeNull();
  });
});

describe("receipts", () => {
  let invoiceId = "";

  beforeAll(async () => {
    for (const type of ["WATER", "ELECTRICITY"] as const) {
      await recordMeterReading(w.property.id, w.owner.id, { roomId: w.room.id, type, billingMonth: "2026-04", previousReading: 0, currentReading: 10 });
    }
    const draft = await generateInvoice(w.property.id, { roomId: w.room.id, billingMonth: "2026-04", issueImmediately: false });
    const issued = await issueInvoice(w.property.id, draft.id, draft.version);
    invoiceId = issued.id;
  });

  it("refuses a receipt before the invoice is paid", async () => {
    const response = await callApi("GET", `/api/v1/admin/properties/${w.property.id}/invoices/${invoiceId}/receipt`, { cookie: w.cookies.owner });
    expect(response.status).toBe(409);
    const tenant = await callApi("GET", `/api/v1/tenant/invoices/${invoiceId}/receipt`, { cookie: w.cookies.tenant });
    expect(tenant.status).toBe(409);
  });

  it("builds the receipt from the paid invoice for the owner and the tenant, and nobody else", async () => {
    const paidAt = new Date("2026-04-06T03:00:00.000Z");
    await getDatabase().invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt } });
    const invoice = await getDatabase().invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { invoiceNumber: true, total: true } });

    const owner = await getPropertyReceiptData(w.property.id, invoiceId);
    expect(owner.data).toMatchObject({
      reference_id: `RC-${invoice.invoiceNumber}`,
      total_amount: Number(invoice.total),
      paid_date: "2026-04-06",
      tenant_name: "EMAIL_RECEIPTS Tenant",
      payment_method: "ชำระกับหอพัก",
    });
    const tenant = await getTenantReceiptData(w.tenantProfileId, invoiceId);
    expect(tenant.data).toEqual(owner.data);

    // หออื่นและผู้เช่าที่ไม่ใช่เจ้าของบิลต้องขอไม่ได้
    await expect(getPropertyReceiptData(w.otherProperty.id, invoiceId)).rejects.toMatchObject({ status: 404 });
    await expect(getTenantReceiptData(w.otherOwner.id, invoiceId)).rejects.toMatchObject({ status: 404 });
    expect((await callApi("GET", `/api/v1/admin/properties/${w.property.id}/invoices/not-an-id/receipt`, { cookie: w.cookies.owner })).status).toBe(404);
    expect((await callApi("GET", `/api/v1/tenant/invoices/${invoiceId}/receipt`)).status).toBe(401);
  });
});
