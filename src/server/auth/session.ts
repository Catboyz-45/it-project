import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { db } from "@/server/db";
import { getAuthEnv } from "@/server/env";
import { randomToken, sha256 } from "@/server/security/crypto";

export type AuthStage = "PASSWORD_VERIFIED" | "TWO_FACTOR_VERIFIED";
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-yuyen_session" : "yuyen_session";
export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export async function createSession(adminId: string, stage: AuthStage, context: { ipHash?: string; userAgent?: string | null }) {
  const env = getAuthEnv(); const token = randomToken(); const now = Date.now();
  const session = await db.session.create({ data: { tokenHash: sha256(token), adminId, twoFactorAt: stage === "TWO_FACTOR_VERIFIED" ? new Date() : null, expiresAt: new Date(now + env.SESSION_ABSOLUTE_HOURS * 3_600_000), lastSeenAt: new Date(), ipAddressHash: context.ipHash, userAgentHash: context.userAgent ? sha256(context.userAgent) : null } });
  return { token, session };
}
export async function rotateSession(sessionId: string, stage: AuthStage) { const token = randomToken(); await db.session.update({ where: { id: sessionId }, data: { tokenHash: sha256(token), twoFactorAt: stage === "TWO_FACTOR_VERIFIED" ? new Date() : null, lastSeenAt: new Date() } }); return token; }
export async function getSessionByToken(token: string | undefined) {
  if (!token) return null; const env = getAuthEnv(); const now = new Date();
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { admin: true } });
  const idleExpired = session ? session.lastSeenAt.getTime() + env.SESSION_IDLE_MINUTES * 60_000 <= now.getTime() : true;
  if (!session || session.revokedAt || session.expiresAt <= now || idleExpired || !session.admin.isActive || session.admin.deletedAt) return null;
  return session;
}
export async function currentSession() { const store = await cookies(); return getSessionByToken(store.get(SESSION_COOKIE)?.value); }
export async function requireAdmin(roles?: AdminRole[]) {
  const session = await currentSession(); if (!session) redirect("/login");
  if (session.admin.mustChangePassword) redirect("/change-password");
  if (!session.admin.twoFactorEnabled) redirect("/setup-2fa");
  if (!session.twoFactorAt) redirect("/verify-2fa");
  if (roles && !roles.includes(session.admin.role)) redirect("/admin?error=forbidden");
  void db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined); return session;
}
export async function revokeUserSessions(adminId: string, exceptId?: string) { await db.session.updateMany({ where: { adminId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { revokedAt: new Date(), revokeReason: "SECURITY_CHANGE" } }); }
