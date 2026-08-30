/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ auth-hardening.e2e.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { createCipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequest, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import * as OTPAuth from "otpauth";

const enabled = process.env.RUN_AUTH_HARDENING_E2E === "1";
const baseURL = process.env.TEST_BASE_URL ?? process.env.APP_URL ?? "http://127.0.0.1:3000";
const origin = process.env.APP_URL ?? baseURL;
const headers = { Origin: origin };
const database = new PrismaClient();
const contexts: APIRequestContext[] = [];
const adminIds: string[] = [];
const createdThrottleKeys = new Set<string>();

function keyedHash(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET!).update(value).digest("hex");
}

function encryptSecret(value: string, version: number) {
  const keyring = process.env.TOTP_ENCRYPTION_KEYS ? JSON.parse(process.env.TOTP_ENCRYPTION_KEYS) as Record<string, string> : {};
  const encoded = keyring[String(version)] ?? (version === 1 ? process.env.TOTP_ENCRYPTION_KEY : undefined);
  if (!encoded) throw new Error(`Missing E2E TOTP key version ${version}`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(encoded, "base64"), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function recoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const normalized = randomBytes(9).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(12, "X").slice(0, 12);
    return { plain: normalized.match(/.{1,4}/g)!.join("-"), hash: keyedHash(normalized) };
  });
}

function token(secret: string, username: string) {
  return new OTPAuth.TOTP({ issuer: "อยู่เย็นเป็นสุข วิศวกรรม", label: username, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }).generate();
}

async function context(playwright: { request: APIRequest }) {
  const result = await playwright.request.newContext({ baseURL });
  contexts.push(result);
  return result;
}

async function createAccount(options: { enrolled?: boolean; keyVersion?: number } = {}) {
  const suffix = randomUUID().slice(0, 8);
  const username = `auth-hardening-${suffix}`;
  const password = `Auth-Hardening-${suffix}!Aa1`;
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const generatedRecoveryCodes = recoveryCodes();
  const enrolled = options.enrolled ?? true;
  const keyVersion = options.keyVersion ?? Number(process.env.TOTP_ENCRYPTION_CURRENT_VERSION ?? "1");
  const admin = await database.admin.create({
    data: {
      username,
      usernameNormalized: username,
      displayName: "Authentication Hardening E2E",
      role: "EDITOR",
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      mustChangePassword: false,
      twoFactorEnabled: enrolled,
      ...(enrolled ? { totpSecretEncrypted: encryptSecret(secret, keyVersion), totpKeyVersion: keyVersion } : {}),
      recoveryCodes: enrolled ? { create: generatedRecoveryCodes.map(item => ({ codeHash: item.hash })) } : undefined,
    },
  });
  adminIds.push(admin.id);
  return { admin, username, password, secret, recoveryCodes: generatedRecoveryCodes.map(item => item.plain) };
}

async function login(client: APIRequestContext, username: string, password: string) {
  return client.post("/api/auth/login", { headers, data: { username, password } });
}

async function fullyAuthenticate(client: APIRequestContext, account: Awaited<ReturnType<typeof createAccount>>) {
  expect((await login(client, account.username, account.password)).status()).toBe(200);
  const response = await client.post("/api/auth/2fa/verify", { headers, data: { code: token(account.secret, account.username) } });
  expect(response.status()).toBe(200);
}

function throttleKeys(purpose: "login" | "totp" | "recovery", account: string) {
  const ipHash = keyedHash("unattributed");
  const keys = [
    keyedHash(`${purpose}:account:${account}`),
    keyedHash(`${purpose}:ip:${ipHash}`),
    keyedHash(`${purpose}:account-ip:${account}:${ipHash}`),
  ];
  keys.forEach(key => createdThrottleKeys.add(key));
  return keys;
}

async function releaseProgressiveDelay(keys: string[]) {
  await database.authThrottle.updateMany({ where: { key: { in: keys } }, data: { lockedUntil: null } });
}

async function clearSharedTestIpThrottle() {
  const ipHash = keyedHash("unattributed");
  await database.authThrottle.deleteMany({
    where: { key: { in: ["login", "totp", "recovery"].map(purpose => keyedHash(`${purpose}:ip:${ipHash}`)) } },
  });
}

test.describe("authentication hardening", () => {
  test.skip(!enabled, "Set RUN_AUTH_HARDENING_E2E=1 and use an isolated test database");
  test.describe.configure({ mode: "serial" });

  test.beforeEach(clearSharedTestIpThrottle);

  test.afterAll(async () => {
    await Promise.all(contexts.map(item => item.dispose()));
    await database.auditLog.deleteMany({ where: { actorId: { in: adminIds } } });
    await database.admin.deleteMany({ where: { id: { in: adminIds } } });
    await database.authThrottle.deleteMany({ where: { key: { in: [...createdThrottleKeys] } } });
    await clearSharedTestIpThrottle();
    await database.$disconnect();
  });

  test("locks and unlocks password login and emits a production-grade cookie", async ({ playwright }) => {
    const account = await createAccount();
    const client = await context(playwright);
    const keys = throttleKeys("login", account.username);
    const attempts = Number(process.env.AUTH_RATE_LIMIT_ATTEMPTS ?? "5");
    for (let index = 1; index <= attempts; index += 1) {
      const response = await login(client, account.username, "Wrong-Password1!");
      if (index < attempts) await releaseProgressiveDelay(keys);
      else {
        expect(response.status()).toBe(429);
        expect(response.headers()["retry-after"]).toBeTruthy();
      }
    }
    expect((await login(client, account.username, account.password)).status()).toBe(429);
    await releaseProgressiveDelay(keys);
    const success = await login(client, account.username, account.password);
    expect(success.status()).toBe(200);
    const cookie = success.headers()["set-cookie"] ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    if (process.env.CI) {
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("__Host-yuyen_session=");
    }
  });

  test("locks and unlocks TOTP and recovery-code verification", async ({ playwright }) => {
    const totpAccount = await createAccount();
    const totpClient = await context(playwright);
    expect((await login(totpClient, totpAccount.username, totpAccount.password)).status()).toBe(200);
    const totpKeys = throttleKeys("totp", totpAccount.admin.id);
    const attempts = Number(process.env.AUTH_RATE_LIMIT_ATTEMPTS ?? "5");
    const validToken = token(totpAccount.secret, totpAccount.username);
    const invalidToken = validToken === "000000" ? "111111" : "000000";
    for (let index = 1; index <= attempts; index += 1) {
      const response = await totpClient.post("/api/auth/2fa/verify", { headers, data: { code: invalidToken } });
      if (index < attempts) await releaseProgressiveDelay(totpKeys);
      else expect(response.status()).toBe(429);
    }
    expect((await totpClient.post("/api/auth/2fa/verify", { headers, data: { code: validToken } })).status()).toBe(429);
    await releaseProgressiveDelay(totpKeys);
    expect((await totpClient.post("/api/auth/2fa/verify", { headers, data: { code: validToken } })).status()).toBe(200);

    const recoveryAccount = await createAccount();
    const recoveryClient = await context(playwright);
    expect((await login(recoveryClient, recoveryAccount.username, recoveryAccount.password)).status()).toBe(200);
    const recoveryKeys = throttleKeys("recovery", recoveryAccount.admin.id);
    for (let index = 1; index <= attempts; index += 1) {
      const response = await recoveryClient.post("/api/auth/recovery", { headers, data: { code: "AAAA-BBBB-CCCC" } });
      if (index < attempts) await releaseProgressiveDelay(recoveryKeys);
      else expect(response.status()).toBe(429);
    }
    expect((await recoveryClient.post("/api/auth/recovery", { headers, data: { code: recoveryAccount.recoveryCodes[0] } })).status()).toBe(429);
    await releaseProgressiveDelay(recoveryKeys);
    expect((await recoveryClient.post("/api/auth/recovery", { headers, data: { code: recoveryAccount.recoveryCodes[0] } })).status()).toBe(200);
  });

  test("revokes logout sessions and rejects idle and absolute expiry", async ({ playwright }) => {
    const logoutAccount = await createAccount();
    const logoutClient = await context(playwright);
    await fullyAuthenticate(logoutClient, logoutAccount);
    const active = await database.session.findFirstOrThrow({ where: { adminId: logoutAccount.admin.id, revokedAt: null }, orderBy: { createdAt: "desc" } });
    expect((await logoutClient.post("/api/auth/logout", { headers })).status()).toBe(200);
    expect((await database.session.findUniqueOrThrow({ where: { id: active.id } })).revokedAt).toBeInstanceOf(Date);
    expect((await logoutClient.get("/admin")).url()).toMatch(/\/login$/);

    for (const expiration of ["idle", "absolute"] as const) {
      const account = await createAccount();
      const client = await context(playwright);
      expect((await login(client, account.username, account.password)).status()).toBe(200);
      const session = await database.session.findFirstOrThrow({ where: { adminId: account.admin.id, revokedAt: null }, orderBy: { createdAt: "desc" } });
      await database.session.update({ where: { id: session.id }, data: expiration === "idle" ? { lastSeenAt: new Date(0) } : { expiresAt: new Date(0) } });
      expect((await client.get("/admin")).url()).toMatch(/\/login$/);
      expect((await client.post("/api/auth/2fa/verify", { headers, data: { code: token(account.secret, account.username) } })).status()).toBe(401);
    }
  });

  test("changes the authenticated user's password and blocks the first-login endpoint in the wrong state", async ({ playwright }) => {
    const account = await createAccount();
    const client = await context(playwright);
    await fullyAuthenticate(client, account);
    expect((await client.post("/api/auth/password", { headers, data: { password: "Wrong-Flow-Password1!", confirm: "Wrong-Flow-Password1!" } })).status()).toBe(403);
    const replacement = `Replacement-${randomUUID().slice(0, 8)}!Aa1`;
    expect((await client.patch("/api/admin/account", { headers, data: { type: "password", currentPassword: account.password, password: replacement, confirm: replacement } })).status()).toBe(200);
    const oldClient = await context(playwright);
    expect((await login(oldClient, account.username, account.password)).status()).toBe(401);
    const newClient = await context(playwright);
    expect((await login(newClient, account.username, replacement)).status()).toBe(200);
  });

  test("rejects reuse of the same TOTP time-step across parallel sessions", async ({ playwright }) => {
    const account = await createAccount();
    const first = await context(playwright);
    const second = await context(playwright);
    expect((await login(first, account.username, account.password)).status()).toBe(200);
    expect((await login(second, account.username, account.password)).status()).toBe(200);
    const code = token(account.secret, account.username);
    expect((await first.post("/api/auth/2fa/verify", { headers, data: { code } })).status()).toBe(200);
    const replay = await second.post("/api/auth/2fa/verify", { headers, data: { code } });
    expect(replay.status()).toBe(409);
    expect(await database.auditLog.findFirst({ where: { actorId: account.admin.id, action: "AUTH_TOTP", errorCode: "TOTP_REPLAYED" } })).not.toBeNull();
  });

  test("re-wraps an old TOTP key through the verification API", async ({ playwright }) => {
    const currentVersion = Number(process.env.TOTP_ENCRYPTION_CURRENT_VERSION ?? "1");
    test.skip(currentVersion < 2, "Server must run with a two-version TOTP keyring");
    const account = await createAccount({ keyVersion: 1 });
    const client = await context(playwright);
    expect((await login(client, account.username, account.password)).status()).toBe(200);
    expect((await client.post("/api/auth/2fa/verify", { headers, data: { code: token(account.secret, account.username) } })).status()).toBe(200);
    const rotated = await database.admin.findUniqueOrThrow({ where: { id: account.admin.id } });
    expect(rotated.totpKeyVersion).toBe(currentVersion);
    expect(rotated.totpSecretEncrypted).not.toBe(account.admin.totpSecretEncrypted);
  });
});
