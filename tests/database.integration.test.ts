/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ database.integration.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { permanentlyDeleteAdmin, restoreAdmin, trashAdmin, updateAdminRecordSafely, updateAdminSafely } from "@/server/auth/admin-users";
import { cleanupAuthenticationRecords } from "@/server/auth/cleanup";
import { authThrottleBuckets, clearFailures, recordFailure, throttleStatus } from "@/server/auth/throttle";
import { auditCmsFailure } from "@/server/cms/http";
import { CmsError } from "@/server/cms/errors";
import { completeAuthentication } from "@/server/auth/session";
import { claimTotpTimeStep } from "@/server/auth/totp-replay";

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
    await db.auditLog.deleteMany({ where: { requestId: { startsWith: prefix } } });
    await db.admin.deleteMany({ where: { usernameNormalized: { startsWith: prefix } } });
    await db.$disconnect();
  });

  it("revokes active sessions when a role changes", async () => {
    const session = await db.session.create({ data: { tokenHash: "a".repeat(64), adminId: secondId, twoFactorAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
    await updateAdminSafely(secondId, { role: "EDITOR" });
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).toBeInstanceOf(Date);
  });

  it("records the completed login time when the second factor succeeds", async () => {
    const session = await db.session.create({
      data: {
        tokenHash: "9".repeat(64),
        adminId: firstId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await completeAuthentication(session.id, firstId);

    const [updatedSession, admin] = await Promise.all([
      db.session.findUniqueOrThrow({ where: { id: session.id } }),
      db.admin.findUniqueOrThrow({ where: { id: firstId } }),
    ]);
    expect(updatedSession.twoFactorAt).toBeInstanceOf(Date);
    expect(admin.lastLoginAt).toBeInstanceOf(Date);
    expect(admin.lastLoginAt?.getTime()).toBe(updatedSession.twoFactorAt?.getTime());
  });

  it("atomically rejects reuse of the same TOTP time-step", async () => {
    const timeStep = Math.floor(Date.now() / 30_000);
    await db.admin.update({ where: { id: firstId }, data: { lastTotpTimeStep: null } });
    const attempts = await Promise.all([
      db.$transaction(tx => claimTotpTimeStep(tx, firstId, timeStep)),
      db.$transaction(tx => claimTotpTimeStep(tx, firstId, timeStep)),
    ]);
    expect(attempts.sort()).toEqual([false, true]);
    await expect(db.$transaction(tx => claimTotpTimeStep(tx, firstId, timeStep - 1))).resolves.toBe(false);
    await expect(db.$transaction(tx => claimTotpTimeStep(tx, firstId, timeStep + 1))).resolves.toBe(true);
  });

  it("prevents demotion and disablement of the final active Super Admin", async () => {
    const rollback = new Error("ROLLBACK_LAST_SUPER_ADMIN_TEST");
    await expect(db.$transaction(async tx => {
      await tx.admin.updateMany({
        where: { id: { not: firstId }, role: "SUPER_ADMIN", isActive: true, deletedAt: null },
        data: { role: "EDITOR" },
      });
      await expect(updateAdminRecordSafely(tx, firstId, { role: "EDITOR" })).rejects.toThrow("LAST_SUPER_ADMIN");
      await expect(updateAdminRecordSafely(tx, firstId, { isActive: false })).rejects.toThrow("LAST_SUPER_ADMIN");
      throw rollback;
    })).rejects.toBe(rollback);

    expect(await db.admin.count({ where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null } })).toBeGreaterThan(0);
  });

  it("trashes, restores, and permanently deletes an administrator safely", async () => {
    const username = `${prefix}-retention`;
    const target = await db.admin.create({ data: { username, usernameNormalized: username, displayName: "Retention Admin", role: "EDITOR", passwordHash: "integration-only-hash", mustChangePassword: false, twoFactorEnabled: true } });
    const session = await db.session.create({ data: { tokenHash: "b".repeat(64), adminId: target.id, twoFactorAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });

    await trashAdmin(target.id, firstId);
    const trashed = await db.admin.findUniqueOrThrow({ where: { id: target.id } });
    expect(trashed).toMatchObject({ isActive: false });
    expect(trashed.deletedAt).toBeInstanceOf(Date);
    expect(trashed.purgeAt!.getTime() - trashed.deletedAt!.getTime()).toBe(30 * 86_400_000);
    expect((await db.session.findUniqueOrThrow({ where: { id: session.id } })).revokeReason).toBe("ADMIN_TRASHED");

    await restoreAdmin(target.id);
    expect(await db.admin.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({ isActive: true, deletedAt: null, purgeAt: null });

    await trashAdmin(target.id, firstId);
    await permanentlyDeleteAdmin(target.id, firstId);
    expect(await db.admin.findUnique({ where: { id: target.id } })).toBeNull();
  });

  it("prevents trashing the current account", async () => {
    await expect(trashAdmin(firstId, firstId)).rejects.toThrow("SELF_ADMIN_OPERATION");
  });

  it("persists rate limits and clears them", async () => {
    const buckets = authThrottleBuckets("login", prefix, "integration-ip");
    await recordFailure(buckets);
    expect(await throttleStatus(buckets)).toBeNull();
    await recordFailure(buckets);
    expect(await throttleStatus(buckets)).toBeInstanceOf(Date);
    await clearFailures(buckets);
    const retained = await db.authThrottle.findUnique({ where: { key: buckets[1].key } });
    expect(retained).not.toBeNull();
    expect(await db.authThrottle.count({ where: { key: { in: [buckets[0].key, buckets[2].key] } } })).toBe(0);
    await db.authThrottle.deleteMany({ where: { key: { in: buckets.map((bucket) => bucket.key) } } });
  });

  it("cleans only authentication records beyond retention", async () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const old = new Date("2026-06-01T00:00:00.000Z");
    const recent = new Date("2026-08-12T12:00:00.000Z");
    const future = new Date("2026-08-14T12:00:00.000Z");
    const tokens = {
      expired: "c".repeat(64),
      revoked: "d".repeat(64),
      recentRevoked: "e".repeat(64),
      active: "f".repeat(64),
    };
    const staleThrottle = "1".repeat(64);
    const activeThrottle = "2".repeat(64);
    const recentThrottle = "3".repeat(64);

    await db.$transaction([
      db.session.create({ data: { tokenHash: tokens.expired, adminId: firstId, expiresAt: old, lastSeenAt: old } }),
      db.session.create({ data: { tokenHash: tokens.revoked, adminId: firstId, expiresAt: future, revokedAt: old, lastSeenAt: old } }),
      db.session.create({ data: { tokenHash: tokens.recentRevoked, adminId: firstId, expiresAt: future, revokedAt: recent, lastSeenAt: recent } }),
      db.session.create({ data: { tokenHash: tokens.active, adminId: firstId, expiresAt: future, lastSeenAt: now } }),
      db.authThrottle.create({ data: { key: staleThrottle, failures: 1, updatedAt: old } }),
      db.authThrottle.create({ data: { key: activeThrottle, failures: 5, lockedUntil: future, updatedAt: old } }),
      db.authThrottle.create({ data: { key: recentThrottle, failures: 1, updatedAt: recent } }),
    ]);

    const result = await cleanupAuthenticationRecords(db, {
      now,
      sessionRetentionDays: 30,
      throttleRetentionDays: 7,
      sessionIdleMinutes: 30,
    });

    expect(result).toEqual({ sessionsDeleted: 2, throttlesDeleted: 1 });
    expect(await db.session.count({ where: { tokenHash: { in: [tokens.expired, tokens.revoked] } } })).toBe(0);
    expect(await db.session.count({ where: { tokenHash: { in: [tokens.recentRevoked, tokens.active] } } })).toBe(2);
    expect(await db.authThrottle.findUnique({ where: { key: staleThrottle } })).toBeNull();
    expect(await db.authThrottle.count({ where: { key: { in: [activeThrottle, recentThrottle] } } })).toBe(2);

    await db.$transaction([
      db.session.deleteMany({ where: { tokenHash: { in: [tokens.recentRevoked, tokens.active] } } }),
      db.authThrottle.deleteMany({ where: { key: { in: [activeThrottle, recentThrottle] } } }),
      db.auditLog.deleteMany({ where: { action: "AUTH_RETENTION_CLEANUP_COMPLETED", createdAt: { gte: new Date(Date.now() - 60_000) } } }),
    ]);
  });

  it("persists failed CMS actions with a safe error code", async () => {
    const requestId = `${prefix}-cms-failure`;
    await auditCmsFailure({ actorId: firstId, action: "CONTENT_PUBLISH_FAILED", kind: "news", targetId: `${prefix}-target`, context: { requestId, ipHash: "hash", userAgent: "integration-test" }, error: new CmsError("INVALID_TRANSITION", "sensitive internal detail") });
    const entry = await db.auditLog.findFirstOrThrow({ where: { requestId } });
    expect(entry).toMatchObject({ actorId: firstId, action: "CONTENT_PUBLISH_FAILED", targetType: "News", targetId: `${prefix}-target`, result: "FAILURE", errorCode: "INVALID_TRANSITION" });
    expect(JSON.stringify(entry.metadata)).not.toContain("sensitive internal detail");
  });
});
