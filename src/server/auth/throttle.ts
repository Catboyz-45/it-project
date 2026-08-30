/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน throttle ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { getAuthEnv } from "@/server/env";
import { keyedHash } from "@/server/security/crypto";

export type AuthThrottlePurpose =
  | "login"
  | "totp"
  | "totp-enrollment"
  | "recovery";
export type AuthThrottleScope = "account" | "ip" | "account-ip";

export type AuthThrottleBucket = {
  key: string;
  thresholdMultiplier: number;
};

/** ฟังก์ชันสาธารณะ authThrottleKey เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function authThrottleKey(
  purpose: AuthThrottlePurpose,
  scope: AuthThrottleScope,
  subject: string,
) {
  return keyedHash(`${purpose}:${scope}:${subject}`);
}

/** ฟังก์ชันสาธารณะ authThrottleBuckets เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function authThrottleBuckets(
  purpose: AuthThrottlePurpose,
  account: string,
  ipHash: string,
): AuthThrottleBucket[] {
  return [
    {
      key: authThrottleKey(purpose, "account", account),
      thresholdMultiplier: 1,
    },
    {
      key: authThrottleKey(purpose, "ip", ipHash),
      // A shared office/NAT address must not be locked as quickly as one account.
      thresholdMultiplier: 5,
    },
    {
      key: authThrottleKey(purpose, "account-ip", `${account}:${ipHash}`),
      thresholdMultiplier: 1,
    },
  ];
}

/** ฟังก์ชันสาธารณะ retryAfterSeconds เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function retryAfterSeconds(lockedUntil: Date, now = Date.now()) {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now) / 1000));
}

/** แปลงหรือจัดรูปข้อมูลด้วย calculateProgressiveDelaySeconds ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function calculateProgressiveDelaySeconds(
  failures: number,
  threshold: number,
) {
  if (failures >= threshold) return 0;
  const progressiveStart = Math.max(2, threshold - 3);
  if (failures < progressiveStart) return 0;
  return Math.min(30, 2 ** (failures - progressiveStart));
}

/** แปลงหรือจัดรูปข้อมูลด้วย calculateLockout ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function calculateLockout(
  failures: number,
  threshold: number,
  minutes: number,
  now = Date.now(),
) {
  if (failures >= threshold) return new Date(now + minutes * 60_000);
  const delaySeconds = calculateProgressiveDelaySeconds(failures, threshold);
  return delaySeconds ? new Date(now + delaySeconds * 1_000) : null;
}

/** ฟังก์ชันสาธารณะ throttleStatus เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export async function throttleStatus(buckets: AuthThrottleBucket[]) {
  const rows = await db.authThrottle.findMany({
    where: { key: { in: buckets.map((bucket) => bucket.key) } },
    select: { lockedUntil: true },
  });
  const now = new Date();
  return rows.reduce<Date | null>((latest, row) => {
    if (!row.lockedUntil || row.lockedUntil <= now) return latest;
    return !latest || row.lockedUntil > latest ? row.lockedUntil : latest;
  }, null);
}

/** ปรับปรุงสถานะผ่าน recordFailure; ผู้เรียกต้องผ่านการตรวจข้อมูลและสิทธิ์ที่เกี่ยวข้องก่อน */
export async function recordFailure(buckets: AuthThrottleBucket[]) {
  const env = getAuthEnv();
  const now = new Date();
  const staleBefore = new Date(
    now.getTime() - env.AUTH_RATE_LIMIT_MINUTES * 60_000,
  );

  return db.$transaction(async (tx) => {
    let latestLock: Date | null = null;
    for (const bucket of buckets) {
      const existing = await tx.authThrottle.findUnique({
        where: { key: bucket.key },
      });
      const failures =
        !existing || existing.updatedAt < staleBefore
          ? 1
          : existing.failures + 1;
      const threshold =
        env.AUTH_RATE_LIMIT_ATTEMPTS * bucket.thresholdMultiplier;
      const lockedUntil = calculateLockout(
        failures,
        threshold,
        env.AUTH_RATE_LIMIT_MINUTES,
        now.getTime(),
      );
      await tx.authThrottle.upsert({
        where: { key: bucket.key },
        create: { key: bucket.key, failures, lockedUntil },
        update: { failures, lockedUntil },
      });
      if (lockedUntil && (!latestLock || lockedUntil > latestLock))
        latestLock = lockedUntil;
    }
    return latestLock;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** ยกเลิกหรือล้างข้อมูลผ่าน clearFailures; โค้ดส่วนนี้คำนึงถึงการอ้างอิงและผลกระทบก่อนเปลี่ยนข้อมูล */
export async function clearFailures(buckets: AuthThrottleBucket[]) {
  // Keep the IP-wide bucket: one successful account must not erase attacks
  // against other accounts coming from the same address.
  const keys = buckets
    .filter((bucket) => bucket.thresholdMultiplier === 1)
    .map((bucket) => bucket.key);
  await db.authThrottle.deleteMany({ where: { key: { in: keys } } });
}
