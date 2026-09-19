import { z } from "zod";

// ค่าที่ไม่ได้ตั้งใน .env จะมาเป็นสตริงว่าง แปลงเป็น undefined จะได้ใช้ค่าเริ่มต้นได้ถูก
const optionalText = z.string().trim().optional().transform((value) => value || undefined);

// ตรวจค่าตั้งค่าทั้งหมดตั้งแต่ตอนเริ่มระบบ ตั้งผิดจะพังทันทีพร้อมบอกว่าตัวไหนผิด
// ดีกว่าไปพังกลางทางตอนมีคนใช้งานอยู่แล้วหาสาเหตุไม่เจอ
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STORAGE_TYPE: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().min(1).default("./storage/documents"),
  PUPPETEER_EXECUTABLE_PATH: optionalText,
  AWS_REGION: optionalText,
  AWS_S3_BUCKET: optionalText,
  AWS_S3_PREFIX: z.string().trim().default("documents"),
  // ความลับที่ใช้ยืนยันว่าคำขอของงานเบื้องหลังมาจากตัวตั้งเวลาจริง อย่างน้อย 32 ตัวเพื่อให้เดาไม่ได้
  JOB_SECRET: optionalText.pipe(z.string().min(32).max(256).optional()),
  SLIP_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
  // 2555 วันคือ 7 ปี ตามระยะเก็บเอกสารที่กฎหมายกำหนด และห้ามตั้งต่ำกว่าหนึ่งปี
  DOCUMENT_RETENTION_DAYS: z.coerce.number().int().min(365).max(3650).default(2555),
  CHAT_ATTACHMENT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
  RETENTION_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  SUBSCRIPTION_GRACE_PERIOD_DAYS: z.coerce.number().int().min(0).max(30).default(7),
});

export type ServerEnv = z.infer<typeof envSchema>;

// ตรวจครั้งเดียวแล้วเก็บไว้ ไม่ต้องตรวจซ้ำทุกครั้งที่มีคำขอเข้ามา
let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= envSchema.parse(process.env);
  // เงื่อนไขข้ามฟิลด์ เลือกใช้ S3 แล้วต้องมี region กับ bucket ด้วย ไม่งั้นอัปโหลดไฟล์จะพังตอนใช้งานจริง
  if (cachedEnv.STORAGE_TYPE === "s3" && (!cachedEnv.AWS_REGION || !cachedEnv.AWS_S3_BUCKET)) {
    throw new Error("AWS_REGION and AWS_S3_BUCKET are required when STORAGE_TYPE=s3");
  }
  return cachedEnv;
}
