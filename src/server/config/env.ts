/**
 * หน้าที่ของไฟล์นี้: อ่านและตรวจสอบ environment variables ตอนเริ่มระบบ เพื่อหยุดทันทีเมื่อค่าจำเป็นผิดหรือหาย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().optional(),
);

const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "DATABASE_URL must use the PostgreSQL protocol",
      ),
    APP_URL: z.string().url(),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    TOTP_ENCRYPTION_KEY: z.string().min(32),
    TOTP_ENCRYPTION_KEYS: z.string().optional(),
    TOTP_ENCRYPTION_CURRENT_VERSION: z.coerce
      .number()
      .int()
      .positive()
      .default(1),
    AUTH_TRUSTED_PROXY_HOPS: z.coerce
      .number()
      .int()
      .min(0)
      .max(10)
      .default(0),
    S3_ENDPOINT: optionalUrl,
    S3_REGION: z.string().min(1).default("auto"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
    S3_CONNECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(60_000)
      .default(5_000),
    S3_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(30_000),
    MEDIA_SIGNED_URL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(300),
    MALWARE_SCAN_MODE: z.enum(["required", "disabled"]).default("disabled"),
    CLAMAV_HOST: z.string().min(1).default("127.0.0.1"),
    CLAMAV_PORT: z.coerce.number().int().min(1).max(65_535).default(3310),
    CLAMAV_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(30_000),
    BOOTSTRAP_ADMIN_USERNAME: z.string().min(3).max(80).optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.MALWARE_SCAN_MODE !== "required") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MALWARE_SCAN_MODE"],
        message: "Malware scanning must be required in production",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

/** อ่านข้อมูลที่จำเป็นสำหรับ getServerEnv โดยไม่ตั้งใจเปลี่ยนข้อมูลต้นทาง */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/** ตรวจเงื่อนไขผ่าน validateServerEnv; คืนผลสำเร็จเฉพาะเมื่อข้อมูลตรงกฎที่ระบบยอมรับ */
export function validateServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  return serverEnvSchema.parse(source);
}
