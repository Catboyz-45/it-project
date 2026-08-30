/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ cms-auth.e2e.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { expect, test } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { randomUUID } from "node:crypto";

test("login rejects invalid credentials without account enumeration", async ({ request }) => {
  const headers = { Origin: process.env.APP_URL ?? "http://localhost:3000" };
  const unknown = await request.post("/api/auth/login", { headers, data: { username: `missing-${randomUUID().slice(0, 8)}`, password: "Wrong-Password1!" } });
  const malformed = await request.post("/api/auth/login", { headers, data: { username: "x", password: "short" } });
  expect(unknown.status()).toBe(401);
  expect((await unknown.json()).error).toBe("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  expect(malformed.status()).toBe(400);
  expect((await malformed.json()).error).toBe("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
});

test("first login enrolls 2FA and completes the CMS publish/trash/restore workflow", async ({ request }) => {
  const username = process.env.E2E_ADMIN_USERNAME; const temporaryPassword = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!username || !temporaryPassword, "E2E bootstrap credentials are not configured");
  const origin = process.env.APP_URL ?? "http://localhost:3000";
  const headers = { Origin: origin };

  const login = await request.post("/api/auth/login", { headers, data: { username, password: temporaryPassword } });
  expect(login.status()).toBe(200); expect((await login.json()).next).toBe("/change-password");
  const password = await request.post("/api/auth/password", { headers, data: { password: "E2e-Secure-Password1!", confirm: "E2e-Secure-Password1!" } });
  expect(password.status()).toBe(200); expect((await password.json()).next).toBe("/setup-2fa");
  const setup = await request.get("/api/auth/2fa/setup");
  expect(setup.status()).toBe(200); const { secret } = await setup.json();
  const code = new OTPAuth.TOTP({ issuer: "อยู่เย็นเป็นสุข วิศวกรรม", label: username!, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }).generate();
  const verified = await request.post("/api/auth/2fa/setup/verify", { headers, data: { code } });
  expect(verified.status()).toBe(200); expect((await verified.json()).recoveryCodes).toHaveLength(10);

  const created = await request.post("/api/admin/content/banners", { headers, data: { title: "E2E security workflow", status: "DRAFT" } });
  expect(created.status()).toBe(201); const id = (await created.json()).record.id;
  expect((await request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "publish" } })).status()).toBe(200);
  expect((await request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "trash" } })).status()).toBe(200);
  expect((await request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "restore" } })).status()).toBe(200);
  expect((await request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "trash" } })).status()).toBe(200);
  expect((await request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "delete" } })).status()).toBe(200);
  const admin = await request.get("/admin"); expect(admin.status()).toBe(200); expect(admin.url()).toMatch(/\/admin$/);
});
