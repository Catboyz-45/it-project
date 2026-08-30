/**
 * หน้าที่ของไฟล์นี้: อ่านและตรวจสอบ environment variables ตอนเริ่มระบบ เพื่อหยุดทันทีเมื่อค่าจำเป็นผิดหรือหาย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TOTP_ENCRYPTION_KEY: z.string().min(40),
  TOTP_ENCRYPTION_KEYS: z.string().optional(),
  TOTP_ENCRYPTION_CURRENT_VERSION: z.coerce
    .number()
    .int()
    .positive()
    .default(1),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  AUTH_RATE_LIMIT_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_RATE_LIMIT_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  AUTH_TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  APP_URL: z.string().url(),
});

export type AuthEnv = z.infer<typeof schema>;
let cached: AuthEnv | undefined;

/** อ่านข้อมูลที่จำเป็นสำหรับ getAuthEnv โดยไม่ตั้งใจเปลี่ยนข้อมูลต้นทาง */
export function getAuthEnv(): AuthEnv {
  cached ??= schema.parse(process.env);
  return cached;
}
