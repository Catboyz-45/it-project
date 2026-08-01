import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { updateAdminSafely } from "@/server/auth/admin-users";
import { clearFailures, recordFailure, throttleStatus } from "@/server/auth/throttle";

const integration = process.env.RUN_INTEGRATION === "1";
const suite = describe.runIf(integration);
const prefix = `it-${randomUUID().slice(0, 8)}`;
let firstId = ""; let secondId = "";

suite("PostgreSQL security integration", () => {
  beforeAll(async () => {
    const users = await db.$transaction([
      db.admin.create({ data: { username: `${prefix}-one`, usernameNormalized: `${prefix}-one`, displayName: "Integration One", role: "SUPER_ADMIN", passwordHash: "integration-only-hash", mustChangePassword: false, twoFactorEnabled: true } }),
      db.admin.create({ data: { username: `${prefix}-two`, usernameNormalized: `${prefix}-two`, displayName: "Integration Two", role: "SUPER_ADMIN", passwordHash: "integration-only-hash", mustChangePassword: false, twoFactorEnabled: true } }),
    ]);
    firstId = users[0].id; secondId = users[1].id;
  });
  afterAll(async () => {
    await db.authThrottle.deleteMany({ where: { key: prefix.padEnd(64, "0") } });
    await db.admin.deleteMany({ where: { usernameNormalized: { startsWith: prefix } } });
    await db.$disconnect();
  });

  it("revokes active sessions when a role changes", async () => {
    const session = await db.session.create({ data: { tokenHash: "a".repeat(64), adminId: secondId, twoFactorAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
    await updateAdminSafely(secondId, { role: "EDITOR" });
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).toBeInstanceOf(Date);
  });

  it("prevents demotion and disablement of the final active Super Admin", async () => {
    await expect(updateAdminSafely(firstId, { role: "EDITOR" })).rejects.toThrow("LAST_SUPER_ADMIN");
    await expect(updateAdminSafely(firstId, { isActive: false })).rejects.toThrow("LAST_SUPER_ADMIN");
  });

  it("persists rate limits and clears them", async () => {
    const key = prefix.padEnd(64, "0");
    for (let index = 0; index < 5; index += 1) await recordFailure(key);
    expect(await throttleStatus(key)).toBeInstanceOf(Date);
    await clearFailures(key);
    expect(await throttleStatus(key)).toBeNull();
  });
});
