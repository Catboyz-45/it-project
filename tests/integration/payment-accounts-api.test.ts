import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { createWorkspaceFixture } from "./helpers";
import { callApi, sessionCookieFor } from "./route-client";

// ช่องทางรับเงินและลิงก์ตั้งรหัสผ่านผ่าน API จริง
// บัญชีรับค่าแพ็กเกจของแพลตฟอร์ม วิธีโอนของคำสั่งซื้อที่รอชำระ และลิงก์ที่ Super Admin ส่งให้เจ้าของหอ

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
let originalSettings: Awaited<ReturnType<ReturnType<typeof getDatabase>["platformPaymentSettings"]["findUnique"]>> = null;
const admin = () => ({ cookie: w.cookies.superAdmin });
const owner = () => ({ cookie: w.cookies.owner });
const emailEnv = { RESEND_API_KEY: "test-key", PASSWORD_RESET_EMAIL_FROM: "noreply@example.test", APP_URL: "http://localhost" };

beforeAll(async () => {
  w = await createWorkspaceFixture("PAYMENT_ACCOUNTS");
  // ตารางนี้มีแถวเดียวทั้งระบบ จำค่าเดิมไว้แล้วคืนให้ตอนจบ เทสต์จะได้ไม่ทิ้งค่าปลอมไว้
  originalSettings = await getDatabase().platformPaymentSettings.findUnique({ where: { id: "default" } });
}, 60_000);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  if (!w) return;
  if (originalSettings) {
    const { id, updatedAt, ...data } = originalSettings;
    void updatedAt;
    await getDatabase().platformPaymentSettings.update({ where: { id }, data });
  } else {
    await getDatabase().platformPaymentSettings.deleteMany({ where: { id: "default" } });
  }
  await getDatabase().passwordResetToken.deleteMany({ where: { userId: w.owner.id } });
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("platform payment settings", () => {
  it("lets only the super admin read and change the subscription bank account", async () => {
    const body = { bankName: "กสิกรไทย", bankAccountNumber: "123-4-56789-0", bankAccountName: "Nestly", promptPayId: "0812345678" };
    expect((await callApi("GET", "/api/v1/super-admin/payment-settings", owner())).status).toBe(403);
    expect((await callApi("PUT", "/api/v1/super-admin/payment-settings", { ...owner(), body })).status).toBe(403);

    const saved = await callApi("PUT", "/api/v1/super-admin/payment-settings", { ...admin(), body });
    expect(saved.status).toBe(200);
    expect(saved.json.data).toMatchObject({ bankAccountNumber: "1234567890", promptPayId: "0812345678" });
    const read = await callApi("GET", "/api/v1/super-admin/payment-settings", admin());
    expect(read.json.data.bankName).toBe("กสิกรไทย");

    // บัญชีไม่ครบชุดหรือมีช่องแปลกปลอมต้องถูกปฏิเสธ
    expect((await callApi("PUT", "/api/v1/super-admin/payment-settings", { ...admin(), body: { bankName: "กสิกรไทย" } })).status).toBe(400);
    expect((await callApi("PUT", "/api/v1/super-admin/payment-settings", { ...admin(), body: { ...body, extra: 1 } })).status).toBe(400);
  });

  it("shows the owner where to transfer for a pending order, with a PromptPay QR for the exact amount", async () => {
    const base = `/api/v1/admin/properties/${w.property.id}/subscription-orders`;
    const ordered = await callApi("POST", base, { ...owner(), body: { planId: "plan_starter" } });
    expect(ordered.status).toBe(201);
    const path = `${base}/${ordered.json.data.id}/payment-instructions`;

    const instructions = await callApi("GET", path, owner());
    expect(instructions.status).toBe(200);
    expect(instructions.json.data).toMatchObject({ bankName: "กสิกรไทย", bankAccountNumber: "1234567890", amount: ordered.json.data.amount });
    expect(instructions.json.data.promptPayPayload).toMatch(/6304[0-9A-F]{4}$/);
    const qr = await callApi("GET", `${path}?format=png`, owner());
    expect(qr.status).toBe(200);
    expect(qr.headers.get("content-type")).toBe("image/png");

    // เจ้าของหออีกหอเปิดดูคำสั่งซื้อของหอนี้ไม่ได้ ตอบว่าไม่พบเหมือน id ที่ไม่มีอยู่จริง
    const otherOwner = { cookie: await sessionCookieFor(w.otherOwner.id) };
    expect((await callApi("GET", path, otherOwner)).status).toBe(404);
    expect((await callApi("GET", `${base}/cnotarealorder000/payment-instructions`, owner())).status).toBe(404);
  });
});

describe("password reset link sent by the super admin", () => {
  it("emails the owner a one-time link without revealing or changing the password", async () => {
    const sent: string[] = [];
    for (const [key, value] of Object.entries(emailEnv)) vi.stubEnv(key, value);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body).text);
      return new Response("{}", { status: 200 });
    }));
    const before = await getDatabase().user.findUniqueOrThrow({ where: { id: w.owner.id }, select: { passwordHash: true } });

    const path = `/api/v1/super-admin/users/${w.owner.id}/password-reset-link`;
    expect((await callApi("POST", path, owner())).status).toBe(403);
    const response = await callApi("POST", path, admin());
    expect(response.status).toBe(200);
    expect(response.json.data.email).toBe(w.owner.email);
    expect(sent.at(-1)).toMatch(/http:\/\/localhost\/reset-password\?token=\S+/);

    // รหัสเดิมยังใช้ได้ จนกว่าเจ้าของหอจะเปิดลิงก์แล้วตั้งใหม่เอง
    const after = await getDatabase().user.findUniqueOrThrow({ where: { id: w.owner.id }, select: { passwordHash: true } });
    expect(after.passwordHash).toBe(before.passwordHash);

    // ส่งให้บัญชีผู้เช่าไม่ได้ เพราะเมนูนี้มีไว้ช่วยเจ้าของหอเท่านั้น
    expect((await callApi("POST", `/api/v1/super-admin/users/${w.tenantUserId}/password-reset-link`, admin())).status).toBe(404);
  });

  // บัญชีที่ admin:bootstrap สร้างใช้ id แบบ UUID เคยโดนตอบว่าไม่พบบัญชีทุกเมนู
  it("works for owner accounts created by the bootstrap script with UUID ids", async () => {
    for (const [key, value] of Object.entries(emailEnv)) vi.stubEnv(key, value);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const id = randomUUID();
    await getDatabase().user.create({
      data: { id, email: `bootstrap-owner-${w.suffix}@example.test`, passwordHash: "x", displayName: "เจ้าของหอจากสคริปต์", role: "PROPERTY_ADMIN", approvalStatus: "APPROVED" },
    });
    try {
      const response = await callApi("POST", `/api/v1/super-admin/users/${id}/password-reset-link`, admin());
      expect(response.status).toBe(200);
    } finally {
      await getDatabase().passwordResetToken.deleteMany({ where: { userId: id } });
      await getDatabase().user.delete({ where: { id } });
    }
  });

  it("tells the super admin when the email could not be sent", async () => {
    for (const [key, value] of Object.entries(emailEnv)) vi.stubEnv(key, value);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await callApi("POST", `/api/v1/super-admin/users/${w.owner.id}/password-reset-link`, admin());
    expect(response.status).toBe(503);
  });
});
