import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { recordLoginFailure } from "@/lib/server/login-throttle";
import { createWorkspaceFixture } from "./helpers";
import { callApi, sessionCookieFor } from "./route-client";

// วงจรรหัสผ่านทั้งหมดผ่าน API จริง ขอรีเซ็ต ตั้งใหม่ด้วยลิงก์ ใช้รหัสชั่วคราว และเปลี่ยนรหัสเอง
// เน้นกฎความปลอดภัย ลิงก์ใช้ได้ครั้งเดียว ตอบเหมือนกันไม่ว่าอีเมลจะมีจริงไหม และเซสชันเดิมถูกถอนทุกครั้ง

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
const emailEnv = { RESEND_API_KEY: "test-key", PASSWORD_RESET_EMAIL_FROM: "noreply@example.test", APP_URL: "http://localhost" };

beforeAll(async () => {
  w = await createWorkspaceFixture("ACCOUNT_API");
}, 60_000);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  if (!w) return;
  await getDatabase().passwordResetToken.deleteMany({ where: { userId: { in: [w.owner.id, w.otherOwner.id, w.tenantUserId] } } });
  await w.cleanup();
  await getDatabase().$disconnect();
});

// ดักการส่งอีเมลออกไปข้างนอก แล้วดึงโทเคนจากลิงก์ในเนื้ออีเมลมาใช้แทนการเปิดกล่องจดหมายจริง
function captureResetEmails(ok = true) {
  const sent: string[] = [];
  for (const [key, value] of Object.entries(emailEnv)) vi.stubEnv(key, value);
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body).text);
    return new Response("{}", { status: ok ? 200 : 500 });
  }));
  return {
    sent,
    token: () => new URL(/http:\/\/localhost\/reset-password\?token=\S+/.exec(sent.at(-1) ?? "")![0]).searchParams.get("token")!,
  };
}

describe("forgot and reset password", () => {
  it("answers the same way for known and unknown emails, and emails a link only to the real account", async () => {
    const mail = captureResetEmails();
    const known = await callApi("POST", "/api/auth/forgot-password", { body: { email: w.owner.email.toUpperCase() } });
    const unknown = await callApi("POST", "/api/auth/forgot-password", { body: { email: `nobody-${w.suffix}@example.test` } });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    // ข้อความเหมือนกันทุกตัวอักษร คนนอกจะเดาไม่ได้ว่าอีเมลไหนมีบัญชีอยู่จริง
    expect(unknown.json.message).toBe(known.json.message);
    expect(mail.sent).toHaveLength(1);
  });

  it("sets a new password with the emailed link exactly once and signs out old sessions", async () => {
    const mail = captureResetEmails();
    await callApi("POST", "/api/auth/forgot-password", { body: { email: w.owner.email } });
    const token = mail.token();

    const reset = await callApi("POST", "/api/auth/reset-password", { body: { token, password: "Reset-Password-456" } });
    expect(reset.status).toBe(200);
    expect(reset.json.redirectTo).toBe("/login?passwordReset=1");
    expect(await getDatabase().session.count({ where: { userId: w.owner.id } })).toBe(0);

    const reused = await callApi("POST", "/api/auth/reset-password", { body: { token, password: "Reset-Password-789" } });
    expect(reused.status).toBe(400);
    // รหัสอ่อนเกินไม่ผ่านการตรวจตั้งแต่ชั้นข้อมูลเข้า
    expect((await callApi("POST", "/api/auth/reset-password", { body: { token, password: "short" } })).status).toBe(400);
  });

  it("still answers 202 when the email provider fails", async () => {
    const mail = captureResetEmails(false);
    const response = await callApi("POST", "/api/auth/forgot-password", { body: { email: w.otherOwner.email } });
    expect(response.status).toBe(202);
    expect(mail.sent).toHaveLength(1);
  });

  it("stops creating new links once the address is throttled", async () => {
    const mail = captureResetEmails();
    const ip = "198.51.100.77";
    // บัญชีจริงของผู้เช่า ถูกระงับไว้แล้วจาก IP นี้ (ขอเกินห้าครั้งในช่วงเวลาที่กำหนด)
    const email = (await getDatabase().user.findUniqueOrThrow({ where: { id: w.tenantUserId }, select: { email: true } })).email;
    for (let attempt = 0; attempt < 5; attempt += 1) await recordLoginFailure(`password-reset:${email}`, ip);
    const response = await callApi("POST", "/api/auth/forgot-password", { body: { email }, headers: { "x-forwarded-for": ip } });
    expect(response.status).toBe(202);
    expect(mail.sent).toHaveLength(0);
    await getDatabase().loginThrottle.deleteMany({});
  });
});

describe("temporary passwords", () => {
  it("lets Super Admin issue a temporary password that must be changed before anything else", async () => {
    const issued = await callApi("POST", `/api/v1/super-admin/users/${w.otherOwner.id}/temporary-password`, { cookie: w.cookies.superAdmin });
    expect(issued.status).toBe(200);
    expect(issued.json.data).toMatchObject({ mustChangePassword: true, temporaryPassword: expect.stringMatching(/^Df1-/) });

    const session = await sessionCookieFor(w.otherOwner.id);
    // ยังไม่เปลี่ยนรหัส ใช้ API อื่นไม่ได้
    expect((await callApi("GET", `/api/v1/admin/properties/${w.otherProperty.id}`, { cookie: session })).status).toBe(403);

    const changed = await callApi("POST", "/api/auth/change-password", { cookie: session, body: { password: "Changed-Password-123" } });
    expect(changed.status).toBe(200);
    // เปลี่ยนแล้วเซสชันเก่าใช้ไม่ได้ ต้องเข้าระบบใหม่
    expect((await callApi("POST", "/api/auth/change-password", { cookie: session, body: { password: "Changed-Password-456" } })).status).toBe(401);

    const fresh = await sessionCookieFor(w.otherOwner.id);
    expect((await callApi("POST", "/api/auth/change-password", { cookie: fresh, body: { password: "Changed-Password-456" } })).status).toBe(403);
  });

  it("refuses to issue a temporary password for a tenant or an unknown id", async () => {
    expect((await callApi("POST", `/api/v1/super-admin/users/${w.tenantUserId}/temporary-password`, { cookie: w.cookies.superAdmin })).status).toBe(404);
    expect((await callApi("POST", "/api/v1/super-admin/users/not-an-id/temporary-password", { cookie: w.cookies.superAdmin })).status).toBe(404);
  });
});

describe("account settings", () => {
  it("updates the display name of the signed-in user", async () => {
    const updated = await callApi("PATCH", "/api/account/profile", { cookie: w.cookies.tenant, body: { displayName: "ชื่อใหม่ของผู้เช่า" } });
    expect(updated.status).toBe(200);
    expect(updated.json.user.displayName).toBe("ชื่อใหม่ของผู้เช่า");
    expect((await callApi("PATCH", "/api/account/profile", { cookie: w.cookies.tenant, body: { displayName: "x" } })).status).toBe(400);
  });

  it("changes the password only with the correct current password", async () => {
    const wrong = await callApi("POST", "/api/account/password", {
      cookie: w.cookies.tenant, body: { currentPassword: "Wrong-Password-1", newPassword: "Account-Password-123" },
    });
    expect(wrong.status).toBe(400);
    const same = await callApi("POST", "/api/account/password", {
      cookie: w.cookies.tenant, body: { currentPassword: "Tenant-Password-123", newPassword: "Tenant-Password-123" },
    });
    expect(same.status).toBe(400);

    const changed = await callApi("POST", "/api/account/password", {
      cookie: w.cookies.tenant, body: { currentPassword: "Tenant-Password-123", newPassword: "Account-Password-123" },
    });
    expect(changed.status).toBe(200);
    expect(changed.json.redirectTo).toBe("/login");
  });
});
