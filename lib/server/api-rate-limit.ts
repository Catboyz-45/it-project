/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “api rate limit” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { getRequestActorContext } from "@/lib/server/request-context";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Rate Limit Policy” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type RateLimitPolicy = { limit: number; windowSeconds: number };

export const rateLimits = {
  chat: { limit: 60, windowSeconds: 60 },
  upload: { limit: 20, windowSeconds: 60 * 10 },
  registration: { limit: 5, windowSeconds: 60 * 60 },
  document: { limit: 10, windowSeconds: 60 * 10 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitPolicy>;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “request Identity” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function requestIdentity(request: NextRequest) {
  const context = getRequestActorContext(request);
  if (context.userId) return `actor:${context.userId}:property:${context.propertyId ?? "platform"}`;
  const session = request.cookies.get("dorm_session")?.value;
  const ip = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  return session ? `session:${session}` : `ip:${ip}`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Api Rate Limit” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - scope: ค่า “scope” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - discriminator: ค่า “discriminator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function assertApiRateLimit(
  request: NextRequest,
  scope: keyof typeof rateLimits,
  discriminator = "",
) {
  const policy = rateLimits[scope];
  const key = createHash("sha256")
    .update(`${scope}:${discriminator}:${requestIdentity(request)}`)
    .digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + policy.windowSeconds * 1000);
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
  if ((rows[0]?.count ?? 1) > policy.limit) {
    throw new ApiError(429, "ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง");
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Upload Rate Limit” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - uploadType: ค่า “upload Type” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function assertUploadRateLimit(request: NextRequest, uploadType: string) {
  const { propertyId } = getRequestActorContext(request);
  return assertApiRateLimit(
    request,
    "upload",
    `${uploadType}:property:${propertyId ?? "platform"}`,
  );
}
