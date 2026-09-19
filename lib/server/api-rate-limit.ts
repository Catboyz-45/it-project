import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { getRequestActorContext } from "@/lib/server/request-context";

type RateLimitPolicy = { limit: number; windowSeconds: number };

// เพดานของแต่ละกลุ่มงาน ตั้งต่างกันตามความหนักและความเสี่ยง
// สมัครสมาชิกกับขอรีเซ็ตรหัสผ่านตั้งไว้ต่ำสุด เพราะเป็นช่องที่ถูกยิงถล่มบ่อย
export const rateLimits = {
  chat: { limit: 60, windowSeconds: 60 },
  upload: { limit: 20, windowSeconds: 60 * 10 },
  registration: { limit: 5, windowSeconds: 60 * 60 },
  document: { limit: 10, windowSeconds: 60 * 10 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitPolicy>;

// ระบุว่าคำขอนี้เป็นของใคร ไล่จากแม่นที่สุดไปหยาบที่สุด
// รู้ตัวผู้ใช้ก็นับรายคน ไม่รู้ก็นับราย session และถ้ายังไม่มีเลยค่อยนับราย IP
function requestIdentity(request: NextRequest) {
  const context = getRequestActorContext(request);
  if (context.userId) return `actor:${context.userId}:property:${context.propertyId ?? "platform"}`;
  const session = request.cookies.get("dorm_session")?.value;
  // x-forwarded-for อาจมีหลาย IP ต่อกัน เอาตัวแรกซึ่งเป็นของผู้ใช้จริง
  const ip = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  return session ? `session:${session}` : `ip:${ip}`;
}

export async function assertApiRateLimit(
  request: NextRequest,
  scope: keyof typeof rateLimits,
  discriminator = "",
) {
  const policy = rateLimits[scope];
  // เก็บเป็น hash ไม่ใช่ตัวระบุตรง ๆ เพราะตารางนี้ไม่จำเป็นต้องรู้ว่าใครเป็นใคร
  const key = createHash("sha256")
    .update(`${scope}:${discriminator}:${requestIdentity(request)}`)
    .digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + policy.windowSeconds * 1000);
  // ใช้ SQL ดิบเพราะต้องนับและเช็คในคำสั่งเดียว ไม่งั้นคำขอที่มาพร้อมกันจะนับตกหล่น
  // เป็น parameterized query ทุกค่า จึงไม่มีช่องให้ SQL injection
  // ON CONFLICT ทำให้เพิ่มค่าเดิมหรือสร้างใหม่ได้ในคำสั่งเดียวโดยไม่ต้องอ่านก่อน
  // CASE คือการเริ่มนับรอบใหม่เมื่อรอบเดิมหมดอายุแล้ว
  const rows = await getDatabase().$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "ApiRateLimit" ("key", "count", "windowStart", "expiresAt", "updatedAt")
    VALUES (${key}, 1, ${now}, ${expiresAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "ApiRateLimit"."expiresAt" <= ${now} THEN 1
        ELSE "ApiRateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "ApiRateLimit"."expiresAt" <= ${now} THEN ${now}
        ELSE "ApiRateLimit"."windowStart"
      END,
      "expiresAt" = CASE
        WHEN "ApiRateLimit"."expiresAt" <= ${now} THEN ${expiresAt}
        ELSE "ApiRateLimit"."expiresAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "expiresAt"
  `;
  // 429 คือรหัสมาตรฐานของการส่งคำขอถี่เกินไป ข้อความเป็นแบบกลาง ๆ ไม่บอกว่าเหลืออีกกี่ครั้ง
  if ((rows[0]?.count ?? 1) > policy.limit) {
    throw new ApiError(429, "ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง");
  }
}

// อัปโหลดนับแยกตามชนิดไฟล์และตามหอ หอหนึ่งอัปโหลดเยอะจะได้ไม่ไปกินโควตาของหออื่น
export async function assertUploadRateLimit(request: NextRequest, uploadType: string) {
  const { propertyId } = getRequestActorContext(request);
  return assertApiRateLimit(
    request,
    "upload",
    `${uploadType}:property:${propertyId ?? "platform"}`,
  );
}
