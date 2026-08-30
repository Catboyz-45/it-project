/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน cleanup ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AuthCleanupOptions = {
  now?: Date;
  sessionRetentionDays: number;
  throttleRetentionDays: number;
  sessionIdleMinutes: number;
};

export type AuthCleanupResult = {
  sessionsDeleted: number;
  throttlesDeleted: number;
};

/** ฟังก์ชันสาธารณะ authCleanupCutoffs เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function authCleanupCutoffs(options: AuthCleanupOptions) {
  const now = options.now ?? new Date();
  const sessionRetentionMs = options.sessionRetentionDays * DAY_MS;
  return {
    now,
    sessionCutoff: new Date(now.getTime() - sessionRetentionMs),
    idleSessionCutoff: new Date(
      now.getTime() -
        sessionRetentionMs -
        options.sessionIdleMinutes * 60 * 1000,
    ),
    throttleCutoff: new Date(
      now.getTime() - options.throttleRetentionDays * DAY_MS,
    ),
  };
}

/** ยกเลิกหรือล้างข้อมูลผ่าน cleanupAuthenticationRecords; โค้ดส่วนนี้คำนึงถึงการอ้างอิงและผลกระทบก่อนเปลี่ยนข้อมูล */
export async function cleanupAuthenticationRecords(
  db: PrismaClient,
  options: AuthCleanupOptions,
): Promise<AuthCleanupResult> {
  const { now, sessionCutoff, idleSessionCutoff, throttleCutoff } =
    authCleanupCutoffs(options);

  return db.$transaction(async (tx) => {
    const sessions = await tx.session.deleteMany({
      where: {
        OR: [
          { revokedAt: { lte: sessionCutoff } },
          { expiresAt: { lte: sessionCutoff } },
          {
            revokedAt: null,
            expiresAt: { gt: now },
            lastSeenAt: { lte: idleSessionCutoff },
          },
        ],
      },
    });
    const throttles = await tx.authThrottle.deleteMany({
      where: {
        updatedAt: { lte: throttleCutoff },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
    });
    await tx.auditLog.create({
      data: {
        action: "AUTH_RETENTION_CLEANUP_COMPLETED",
        targetType: "System",
        result: "SUCCESS",
        metadata: {
          sessionsDeleted: sessions.count,
          throttlesDeleted: throttles.count,
          sessionRetentionDays: options.sessionRetentionDays,
          throttleRetentionDays: options.throttleRetentionDays,
        },
      },
    });
    return {
      sessionsDeleted: sessions.count,
      throttlesDeleted: throttles.count,
    };
  });
}
