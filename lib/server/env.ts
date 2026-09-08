/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “env” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { z } from "zod";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “optional Text” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const optionalText = z.string().trim().optional().transform((value) => value || undefined);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STORAGE_TYPE: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().min(1).default("./storage/documents"),
  PUPPETEER_EXECUTABLE_PATH: optionalText,
  AWS_REGION: optionalText,
  AWS_S3_BUCKET: optionalText,
  AWS_S3_PREFIX: z.string().trim().default("documents"),
  JOB_SECRET: optionalText.pipe(z.string().min(32).max(256).optional()),
  SLIP_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
  DOCUMENT_RETENTION_DAYS: z.coerce.number().int().min(365).max(3650).default(2555),
  CHAT_ATTACHMENT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
  RETENTION_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  SUBSCRIPTION_GRACE_PERIOD_DAYS: z.coerce.number().int().min(0).max(30).default(7),
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Server Env” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ServerEnv = z.infer<typeof envSchema>;

let cachedEnv: ServerEnv | undefined;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Server Env” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลชนิด ServerEnv ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function getServerEnv(): ServerEnv {
  cachedEnv ??= envSchema.parse(process.env);
  if (cachedEnv.STORAGE_TYPE === "s3" && (!cachedEnv.AWS_REGION || !cachedEnv.AWS_S3_BUCKET)) {
    throw new Error("AWS_REGION and AWS_S3_BUCKET are required when STORAGE_TYPE=s3");
  }
  return cachedEnv;
}
