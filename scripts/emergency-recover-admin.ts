import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

async function main() {
  const db = new PrismaClient();
  const username = process.env.RECOVERY_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.RECOVERY_TEMPORARY_PASSWORD;
  if (!username || !password || password.length < 12) throw new Error("Set RECOVERY_ADMIN_USERNAME and RECOVERY_TEMPORARY_PASSWORD of at least 12 characters");
  try {
    const user = await db.admin.findUnique({ where: { usernameNormalized: username } });
    if (!user || user.role !== "SUPER_ADMIN") throw new Error("Super Admin account not found");
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    await db.$transaction([
      db.admin.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: true, twoFactorEnabled: false, totpSecretEncrypted: null, totpKeyVersion: null, isActive: true, deletedAt: null, purgeAt: null } }),
      db.session.updateMany({ where: { adminId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "EMERGENCY_RECOVERY" } }),
      db.recoveryCode.deleteMany({ where: { adminId: user.id } }),
      db.auditLog.create({ data: { actorId: user.id, action: "EMERGENCY_ADMIN_RECOVERY", targetType: "Admin", targetId: user.id, result: "SUCCESS", metadata: { source: "server-cli" } } }),
    ]);
    console.log("Emergency recovery completed. Sessions and 2FA were revoked; password change and enrollment are required.");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Recovery failed"); process.exitCode = 1; });
