/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน admin-users ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { Prisma, type AdminRole } from "@prisma/client";
import { db } from "@/server/db";
import { hashPassword, randomToken } from "@/server/security/crypto";
import { retentionDate } from "@/server/cms/rules";
import { wouldRemoveLastActiveSuperAdmin } from "./admin-rules";
import { revokeUserSessions } from "./session";

/** สร้างข้อมูลหรือเริ่มกระบวนการ createAdmin พร้อมใช้กฎตรวจสอบของฝั่งเซิร์ฟเวอร์ */
export async function createAdmin(input: { username: string; displayName: string; role: AdminRole }) {
  const temporaryPassword = `${randomToken(12)}Aa!1`; const passwordHash = await hashPassword(temporaryPassword);
  const normalized = input.username.toLowerCase(); const user = await db.admin.create({ data: { username: input.username, usernameNormalized: normalized, displayName: input.displayName, role: input.role, passwordHash, mustChangePassword: true } });
  return { user, temporaryPassword };
}

type AdminUpdate = { displayName?: string; role?: AdminRole; isActive?: boolean };

/** ปรับปรุงสถานะผ่าน updateAdminRecordSafely; ผู้เรียกต้องผ่านการตรวจข้อมูลและสิทธิ์ที่เกี่ยวข้องก่อน */
export async function updateAdminRecordSafely(tx: Prisma.TransactionClient, userId: string, input: AdminUpdate) {
  const target = await tx.admin.findUniqueOrThrow({ where: { id: userId } });
  const removingSuperAccess = target.role === "SUPER_ADMIN" && target.isActive && (input.role === "EDITOR" || input.isActive === false);
  if (removingSuperAccess) {
    const activeSuperAdmins = await tx.admin.count({ where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null } });
    if (wouldRemoveLastActiveSuperAdmin(target, input, activeSuperAdmins)) throw new Error("LAST_SUPER_ADMIN");
  }
  return tx.admin.update({ where: { id: userId }, data: input });
}

/** ปรับปรุงสถานะผ่าน updateAdminSafely; ผู้เรียกต้องผ่านการตรวจข้อมูลและสิทธิ์ที่เกี่ยวข้องก่อน */
export async function updateAdminSafely(userId: string, input: AdminUpdate) {
  const result = await db.$transaction(tx => updateAdminRecordSafely(tx, userId, input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (input.role !== undefined || input.isActive !== undefined) await revokeUserSessions(userId);
  return result;
}

/** ออก temporary password ใหม่ บังคับเปลี่ยนครั้งถัดไป และยกเลิก session เดิม */
export async function resetAdminPassword(userId: string) {
  const temporaryPassword = `${randomToken(12)}Aa!1`; const passwordHash = await hashPassword(temporaryPassword);
  await db.admin.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } }); await revokeUserSessions(userId);
  return temporaryPassword;
}

/** ล้าง TOTP และ recovery codes เดิม เพื่อบังคับลงทะเบียน 2FA ใหม่ */
export async function resetAdminTwoFactor(userId: string) {
  await db.$transaction([db.admin.update({ where: { id: userId }, data: { twoFactorEnabled: false, totpSecretEncrypted: null, totpKeyVersion: null, lastTotpTimeStep: null } }), db.recoveryCode.deleteMany({ where: { adminId: userId } }), db.session.updateMany({ where: { adminId: userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "TWO_FACTOR_RESET" } })]);
}

/** ย้ายบัญชีลงถังขยะหลังตรวจว่าไม่ใช่ตนเองและไม่ใช่ Super Admin คนสุดท้าย */
export async function trashAdmin(userId: string, actorId: string) {
  if (userId === actorId) throw new Error("SELF_ADMIN_OPERATION");
  await db.$transaction(async tx => {
    const target = await tx.admin.findUniqueOrThrow({ where: { id: userId } });
    if (target.deletedAt) throw new Error("ADMIN_ALREADY_TRASHED");
    if (target.role === "SUPER_ADMIN" && target.isActive) {
      const activeSuperAdmins = await tx.admin.count({ where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null } });
      if (activeSuperAdmins <= 1) throw new Error("LAST_SUPER_ADMIN");
    }
    const now = new Date();
    await tx.admin.update({ where: { id: userId }, data: { isActive: false, deletedAt: now, purgeAt: retentionDate(now) } });
    await tx.session.updateMany({ where: { adminId: userId, revokedAt: null }, data: { revokedAt: now, revokeReason: "ADMIN_TRASHED" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** กู้บัญชีจากถังขยะกลับมาแบบปิดใช้งาน เพื่อให้ Super Admin ตรวจสอบก่อนเปิด */
export async function restoreAdmin(userId: string) {
  await db.admin.updateMany({ where: { id: userId, deletedAt: { not: null } }, data: { isActive: true, deletedAt: null, purgeAt: null } }).then(result => {
    if (result.count !== 1) throw new Error("ADMIN_NOT_TRASHED");
  });
}

/** ลบบัญชีถาวรตามสิทธิ์และกฎ retention โดยป้องกัน Super Admin คนสุดท้าย */
export async function permanentlyDeleteAdmin(userId: string, actorId: string) {
  if (userId === actorId) throw new Error("SELF_ADMIN_OPERATION");
  await db.$transaction(async tx => {
    const target = await tx.admin.findUniqueOrThrow({ where: { id: userId } });
    if (!target.deletedAt) throw new Error("ADMIN_NOT_TRASHED");
    await tx.admin.delete({ where: { id: userId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
