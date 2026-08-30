/**
 * หน้าที่ของไฟล์นี้: คำสั่งดูแลระบบ cleanup-auth; รันจากเครื่องหรือเซิร์ฟเวอร์ที่เชื่อถือได้ตามคู่มือใน docs
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import "dotenv/config";
import { z } from "zod";
import { cleanupAuthenticationRecords } from "../src/server/auth/cleanup";
import { db } from "../src/server/db";

const envSchema = z.object({
  AUTH_SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_THROTTLE_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
});

async function main() {
  const env = envSchema.parse(process.env);
  const result = await cleanupAuthenticationRecords(db, {
    sessionRetentionDays: env.AUTH_SESSION_RETENTION_DAYS,
    throttleRetentionDays: env.AUTH_THROTTLE_RETENTION_DAYS,
    sessionIdleMinutes: env.SESSION_IDLE_MINUTES,
  });
  process.stdout.write(
    `Authentication cleanup completed: ${result.sessionsDeleted} sessions and ${result.throttlesDeleted} throttle records deleted.\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Authentication cleanup failed"}\n`,
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
