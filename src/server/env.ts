import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TOTP_ENCRYPTION_KEY: z.string().min(40),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  AUTH_RATE_LIMIT_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_RATE_LIMIT_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  APP_URL: z.string().url(),
});

export type AuthEnv = z.infer<typeof schema>;
let cached: AuthEnv | undefined;

export function getAuthEnv(): AuthEnv {
  cached ??= schema.parse(process.env);
  return cached;
}
