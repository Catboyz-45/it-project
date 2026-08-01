import "server-only";
import { db } from "@/server/db";
import { getAuthEnv } from "@/server/env";

export async function throttleStatus(key: string) { const row = await db.authThrottle.findUnique({ where: { key } }); return row?.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil : null; }
export async function recordFailure(key: string) {
  const env = getAuthEnv(); const existing = await db.authThrottle.findUnique({ where: { key } }); const failures = (existing?.failures ?? 0) + 1;
  const lockedUntil = calculateLockout(failures, env.AUTH_RATE_LIMIT_ATTEMPTS, env.AUTH_RATE_LIMIT_MINUTES);
  await db.authThrottle.upsert({ where: { key }, create: { key, failures, lockedUntil }, update: { failures, lockedUntil } });
  return lockedUntil;
}
export async function clearFailures(key: string) { await db.authThrottle.delete({ where: { key } }).catch(() => undefined); }
export function calculateLockout(failures: number, attempts: number, minutes: number, now = Date.now()) { return failures >= attempts ? new Date(now + minutes * 60_000) : null; }
