import "server-only";
import { Prisma, type AdminRole } from "@prisma/client";
import { db } from "@/server/db";
import { hashPassword, randomToken } from "@/server/security/crypto";
import { revokeUserSessions } from "./session";

export async function createAdmin(input: { username: string; displayName: string; role: AdminRole }) {
  const temporaryPassword = `${randomToken(12)}Aa!1`; const passwordHash = await hashPassword(temporaryPassword);
  const normalized = input.username.toLowerCase(); const user = await db.admin.create({ data: { username: input.username, usernameNormalized: normalized, displayName: input.displayName, role: input.role, passwordHash, mustChangePassword: true } });
  return { user, temporaryPassword };
}

export async function updateAdminSafely(userId: string, input: { displayName?: string; role?: AdminRole; isActive?: boolean }) {
  const result = await db.$transaction(async tx => {
    const target = await tx.admin.findUniqueOrThrow({ where: { id: userId } });
    const removingSuperAccess = target.role === "SUPER_ADMIN" && target.isActive && (input.role === "EDITOR" || input.isActive === false);
    if (removingSuperAccess) {
      const activeSuperAdmins = await tx.admin.count({ where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null } });
      if (activeSuperAdmins <= 1) throw new Error("LAST_SUPER_ADMIN");
    }
    return tx.admin.update({ where: { id: userId }, data: input });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (input.role !== undefined || input.isActive !== undefined) await revokeUserSessions(userId);
  return result;
}

export async function resetAdminPassword(userId: string) {
  const temporaryPassword = `${randomToken(12)}Aa!1`; const passwordHash = await hashPassword(temporaryPassword);
  await db.admin.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } }); await revokeUserSessions(userId);
  return temporaryPassword;
}

export async function resetAdminTwoFactor(userId: string) {
  await db.$transaction([db.admin.update({ where: { id: userId }, data: { twoFactorEnabled: false, totpSecretEncrypted: null, totpKeyVersion: null } }), db.recoveryCode.deleteMany({ where: { adminId: userId } }), db.session.updateMany({ where: { adminId: userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "TWO_FACTOR_RESET" } })]);
}
