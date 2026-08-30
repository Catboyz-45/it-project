/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน session ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { db } from "@/server/db";
import { getAuthEnv } from "@/server/env";
import { randomToken, sha256 } from "@/server/security/crypto";
import { claimTotpTimeStep } from "@/server/auth/totp-replay";

export type AuthStage = "PASSWORD_VERIFIED" | "TWO_FACTOR_VERIFIED";
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-yuyen_session" : "yuyen_session";
/** ฟังก์ชันสาธารณะ sessionCookieOptionsFor เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function sessionCookieOptionsFor(environment: string | undefined) {
  return { httpOnly: true, secure: environment === "production", sameSite: "lax" as const, path: "/" };
}
export const sessionCookieOptions = sessionCookieOptionsFor(process.env.NODE_ENV);

/** สร้างข้อมูลหรือเริ่มกระบวนการ createSession พร้อมใช้กฎตรวจสอบของฝั่งเซิร์ฟเวอร์ */
export async function createSession(adminId: string, stage: AuthStage, context: { ipHash?: string; userAgent?: string | null }) {
  const env = getAuthEnv(); const token = randomToken(); const now = Date.now();
  const session = await db.session.create({ data: { tokenHash: sha256(token), adminId, twoFactorAt: stage === "TWO_FACTOR_VERIFIED" ? new Date() : null, expiresAt: new Date(now + env.SESSION_ABSOLUTE_HOURS * 3_600_000), lastSeenAt: new Date(), ipAddressHash: context.ipHash, userAgentHash: context.userAgent ? sha256(context.userAgent) : null } });
  return { token, session };
}
/** ปรับปรุงสถานะผ่าน rotateSession; ผู้เรียกต้องผ่านการตรวจข้อมูลและสิทธิ์ที่เกี่ยวข้องก่อน */
export async function rotateSession(sessionId: string, stage: AuthStage) { const token = randomToken(); await db.session.update({ where: { id: sessionId }, data: { tokenHash: sha256(token), twoFactorAt: stage === "TWO_FACTOR_VERIFIED" ? new Date() : null, lastSeenAt: new Date() } }); return token; }
/** ปรับปรุงสถานะผ่าน completeAuthentication; ผู้เรียกต้องผ่านการตรวจข้อมูลและสิทธิ์ที่เกี่ยวข้องก่อน */
export function completeAuthentication(
  sessionId: string,
  adminId: string,
): Promise<string>;
/** ปรับปรุงสถานะผ่าน completeAuthentication; ผู้เรียกต้องผ่านการตรวจข้อมูลและสิทธิ์ที่เกี่ยวข้องก่อน */
export function completeAuthentication(
  sessionId: string,
  adminId: string,
  totpTimeStep: number,
): Promise<string | null>;
/** ปรับปรุงสถานะผ่าน completeAuthentication; ผู้เรียกต้องผ่านการตรวจข้อมูลและสิทธิ์ที่เกี่ยวข้องก่อน */
export async function completeAuthentication(
  sessionId: string,
  adminId: string,
  totpTimeStep?: number,
): Promise<string | null> {
  const token = randomToken();
  const authenticatedAt = new Date();
  const completed = await db.$transaction(async tx => {
    if (
      totpTimeStep !== undefined &&
      !(await claimTotpTimeStep(tx, adminId, totpTimeStep))
    )
      return false;
    await tx.session.update({
      where: { id: sessionId },
      data: {
        tokenHash: sha256(token),
        twoFactorAt: authenticatedAt,
        lastSeenAt: authenticatedAt,
      },
    });
    await tx.admin.update({
      where: { id: adminId },
      data: { lastLoginAt: authenticatedAt },
    });
    return true;
  });
  return completed ? token : null;
}
/** อ่านข้อมูลที่จำเป็นสำหรับ getSessionByToken โดยไม่ตั้งใจเปลี่ยนข้อมูลต้นทาง */
export async function getSessionByToken(token: string | undefined) {
  if (!token) return null; const env = getAuthEnv(); const now = new Date();
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { admin: true } });
  const idleExpired = session ? session.lastSeenAt.getTime() + env.SESSION_IDLE_MINUTES * 60_000 <= now.getTime() : true;
  if (!session || session.revokedAt || session.expiresAt <= now || idleExpired || !session.admin.isActive || session.admin.deletedAt) return null;
  return session;
}
/** อ่าน session token จาก HttpOnly cookie แล้วตรวจฐานข้อมูลว่า session และบัญชียังใช้งานได้ */
export async function currentSession() { const store = await cookies(); return getSessionByToken(store.get(SESSION_COOKIE)?.value); }
/** ตรวจเงื่อนไขผ่าน requireAdmin; คืนผลสำเร็จเฉพาะเมื่อข้อมูลตรงกฎที่ระบบยอมรับ */
export async function requireAdmin(roles?: AdminRole[]) {
  const session = await currentSession(); if (!session) redirect("/login");
  if (session.admin.mustChangePassword) redirect("/change-password");
  if (!session.admin.twoFactorEnabled) redirect("/setup-2fa");
  if (!session.twoFactorAt) redirect("/verify-2fa");
  if (roles && !roles.includes(session.admin.role)) redirect("/admin?error=forbidden");
  void db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined); return session;
}
/** ยกเลิกหรือล้างข้อมูลผ่าน revokeUserSessions; โค้ดส่วนนี้คำนึงถึงการอ้างอิงและผลกระทบก่อนเปลี่ยนข้อมูล */
export async function revokeUserSessions(adminId: string, exceptId?: string) { await db.session.updateMany({ where: { adminId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { revokedAt: new Date(), revokeReason: "SECURITY_CHANGE" } }); }
