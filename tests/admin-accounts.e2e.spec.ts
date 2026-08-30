/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ admin-accounts.e2e.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequest, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import * as OTPAuth from "otpauth";

const enabled = process.env.RUN_ADMIN_E2E === "1";
const baseURL = process.env.TEST_BASE_URL ?? process.env.APP_URL ?? "http://127.0.0.1:3000";
const origin = process.env.APP_URL ?? baseURL;

type EnrolledAccount = {
  context: APIRequestContext;
  recoveryCodes: string[];
};

async function signInAndEnroll(
  playwright: { request: APIRequest },
  username: string,
  temporaryPassword: string,
  permanentPassword: string,
): Promise<EnrolledAccount> {
  const context = await playwright.request.newContext({ baseURL });
  const headers = { Origin: origin };
  const login = await context.post("/api/auth/login", {
    headers,
    data: { username, password: temporaryPassword },
  });
  expect(login.status()).toBe(200);
  expect((await login.json()).next).toBe("/change-password");

  const password = await context.post("/api/auth/password", {
    headers,
    data: { password: permanentPassword, confirm: permanentPassword },
  });
  expect(password.status()).toBe(200);
  expect((await password.json()).next).toBe("/setup-2fa");

  const setup = await context.get("/api/auth/2fa/setup");
  expect(setup.status()).toBe(200);
  const { secret } = (await setup.json()) as { secret: string };
  const code = new OTPAuth.TOTP({
    issuer: "อยู่เย็นเป็นสุข วิศวกรรม",
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
  const verified = await context.post("/api/auth/2fa/setup/verify", {
    headers,
    data: { code },
  });
  expect(verified.status()).toBe(200);
  const result = (await verified.json()) as { recoveryCodes: string[] };
  expect(result.recoveryCodes).toHaveLength(10);
  const authenticated = await new PrismaClient().admin.findUniqueOrThrow({
    where: { usernameNormalized: username.toLowerCase() },
    select: { lastLoginAt: true },
  });
  expect(authenticated.lastLoginAt).toBeInstanceOf(Date);
  return { context, recoveryCodes: result.recoveryCodes };
}

test.describe("administrator account lifecycle", () => {
  test.skip(!enabled, "Set RUN_ADMIN_E2E=1 and use an isolated test database");
  test.describe.configure({ mode: "serial" });

  test("enforces roles and covers password reset, 2FA reset, disable, trash, restore, and recovery", async ({ playwright }) => {
    test.setTimeout(120_000);
    const database = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const superUsername = `admin-e2e-super-${suffix}`;
    const editorUsername = `admin-e2e-editor-${suffix}`;
    const targetUsername = `admin-e2e-target-${suffix}`;
    const superTemporary = `Super-Temporary-${suffix}!Aa1`;
    const superPermanent = `Super-Permanent-${suffix}!Aa1`;
    const editorTemporary = `Editor-Temporary-${suffix}!Aa1`;
    const editorPermanent = `Editor-Permanent-${suffix}!Aa1`;
    const targetPermanent = `Target-Permanent-${suffix}!Aa1`;
    const headers = { Origin: origin };
    const createdAdminIds: string[] = [];
    const contexts: APIRequestContext[] = [];

    try {
      const seeded = await database.$transaction([
        database.admin.create({
          data: {
            username: superUsername,
            usernameNormalized: superUsername,
            displayName: "Admin E2E Super",
            role: "SUPER_ADMIN",
            passwordHash: await argon2.hash(superTemporary, { type: argon2.argon2id }),
            mustChangePassword: true,
          },
        }),
        database.admin.create({
          data: {
            username: editorUsername,
            usernameNormalized: editorUsername,
            displayName: "Admin E2E Editor",
            role: "EDITOR",
            passwordHash: await argon2.hash(editorTemporary, { type: argon2.argon2id }),
            mustChangePassword: true,
          },
        }),
      ]);
      createdAdminIds.push(...seeded.map(item => item.id));

      const superAccount = await signInAndEnroll(playwright, superUsername, superTemporary, superPermanent);
      const editorAccount = await signInAndEnroll(playwright, editorUsername, editorTemporary, editorPermanent);
      contexts.push(superAccount.context, editorAccount.context);

      const firstLoginPasswordEndpoint = await editorAccount.context.post(
        "/api/auth/password",
        {
          headers,
          data: {
            password: `Unauthorized-Password-${suffix}!Aa1`,
            confirm: `Unauthorized-Password-${suffix}!Aa1`,
          },
        },
      );
      expect(firstLoginPasswordEndpoint.status()).toBe(403);

      expect((await editorAccount.context.get("/api/admin/users")).status()).toBe(403);
      expect((await editorAccount.context.post("/api/admin/users", {
        headers,
        data: { username: targetUsername, displayName: "Target Admin", role: "EDITOR" },
      })).status()).toBe(403);

      const created = await superAccount.context.post("/api/admin/users", {
        headers,
        data: { username: targetUsername, displayName: "Target Admin", role: "EDITOR" },
      });
      expect(created.status()).toBe(201);
      const createdBody = (await created.json()) as { user: { id: string }; temporaryPassword: string };
      const targetId = createdBody.user.id;
      createdAdminIds.push(targetId);

      const targetAccount = await signInAndEnroll(playwright, targetUsername, createdBody.temporaryPassword, targetPermanent);
      contexts.push(targetAccount.context);

      const resetPassword = await superAccount.context.post(`/api/admin/users/${targetId}/reset-password`, { headers, data: {} });
      expect(resetPassword.status()).toBe(200);
      const resetPasswordBody = (await resetPassword.json()) as { temporaryPassword: string };
      const oldPasswordLogin = await playwright.request.newContext({ baseURL });
      contexts.push(oldPasswordLogin);
      expect((await oldPasswordLogin.post("/api/auth/login", {
        headers,
        data: { username: targetUsername, password: targetPermanent },
      })).status()).toBe(401);
      const resetLogin = await playwright.request.newContext({ baseURL });
      contexts.push(resetLogin);
      const resetLoginResponse = await resetLogin.post("/api/auth/login", {
        headers,
        data: { username: targetUsername, password: resetPasswordBody.temporaryPassword },
      });
      expect(resetLoginResponse.status()).toBe(200);
      expect((await resetLoginResponse.json()).next).toBe("/change-password");

      const resetTwoFactor = await superAccount.context.post(`/api/admin/users/${targetId}/reset-2fa`, { headers, data: {} });
      expect(resetTwoFactor.status()).toBe(200);
      const targetAfterTwoFactorReset = await database.admin.findUniqueOrThrow({ where: { id: targetId } });
      expect(targetAfterTwoFactorReset.twoFactorEnabled).toBe(false);
      expect(targetAfterTwoFactorReset.totpSecretEncrypted).toBeNull();
      expect(targetAfterTwoFactorReset.lastTotpTimeStep).toBeNull();
      expect(await database.recoveryCode.count({ where: { adminId: targetId } })).toBe(0);

      expect((await superAccount.context.patch(`/api/admin/users/${targetId}`, {
        headers,
        data: { isActive: false },
      })).status()).toBe(200);
      const disabledLogin = await playwright.request.newContext({ baseURL });
      contexts.push(disabledLogin);
      expect((await disabledLogin.post("/api/auth/login", {
        headers,
        data: { username: targetUsername, password: resetPasswordBody.temporaryPassword },
      })).status()).toBe(401);
      expect((await superAccount.context.patch(`/api/admin/users/${targetId}`, {
        headers,
        data: { isActive: true },
      })).status()).toBe(200);

      expect((await superAccount.context.post(`/api/admin/users/${targetId}/transition`, {
        headers,
        data: { action: "trash" },
      })).status()).toBe(200);
      const trashed = await database.admin.findUniqueOrThrow({ where: { id: targetId } });
      expect(trashed.isActive).toBe(false);
      expect(trashed.deletedAt).toBeInstanceOf(Date);
      expect(trashed.purgeAt).toBeInstanceOf(Date);
      const trash = await superAccount.context.get("/api/admin/trash");
      expect(trash.status()).toBe(200);
      expect(((await trash.json()) as { items: Array<{ id: string; kind: string }> }).items).toContainEqual(expect.objectContaining({ id: targetId, kind: "admins" }));
      expect((await superAccount.context.post(`/api/admin/users/${targetId}/transition`, {
        headers,
        data: { action: "restore" },
      })).status()).toBe(200);

      const recoveryContext = await playwright.request.newContext({ baseURL });
      contexts.push(recoveryContext);
      expect((await recoveryContext.post("/api/auth/login", {
        headers,
        data: { username: editorUsername, password: editorPermanent },
      })).status()).toBe(200);
      const recovered = await recoveryContext.post("/api/auth/recovery", {
        headers,
        data: { code: editorAccount.recoveryCodes[0] },
      });
      expect(recovered.status()).toBe(200);
      expect((await recovered.json()).next).toBe("/admin");
      expect((await recoveryContext.post("/api/auth/recovery", {
        headers,
        data: { code: editorAccount.recoveryCodes[0] },
      })).status()).toBe(401);

      const actions = await database.auditLog.findMany({
        where: { targetId: targetId },
        select: { action: true, result: true },
      });
      expect(actions).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: "ADMIN_PASSWORD_RESET", result: "SUCCESS" }),
        expect.objectContaining({ action: "ADMIN_TWO_FACTOR_RESET", result: "SUCCESS" }),
        expect.objectContaining({ action: "ADMIN_TRASHED", result: "SUCCESS" }),
        expect.objectContaining({ action: "ADMIN_RESTORED", result: "SUCCESS" }),
      ]));
    } finally {
      await Promise.all(contexts.map(context => context.dispose()));
      await database.auditLog.deleteMany({ where: { OR: [{ actorId: { in: createdAdminIds } }, { targetId: { in: createdAdminIds } }] } });
      await database.admin.deleteMany({ where: { id: { in: createdAdminIds } } });
      await database.$disconnect();
    }
  });
});
