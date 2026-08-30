/**
 * หน้าที่ของไฟล์นี้: กลไกความปลอดภัย request สำหรับตรวจคำขอ เข้ารหัส หรือยืนยันข้อมูลสำคัญก่อนระบบเชื่อถือ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthEnv } from "@/server/env";
import { keyedHash } from "./crypto";
import { resolveForwardedClientIp } from "./client-ip";

/** ฟังก์ชันสาธารณะ requestContext เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function requestContext(request: NextRequest) {
  const ip = resolveForwardedClientIp(
    request.headers.get("x-forwarded-for"),
    getAuthEnv().AUTH_TRUSTED_PROXY_HOPS,
  ) ?? "unattributed";
  return { requestId: request.headers.get("x-request-id") || randomUUID(), ipHash: keyedHash(ip), userAgent: request.headers.get("user-agent")?.slice(0, 500) || null };
}
/** ตรวจเงื่อนไขผ่าน assertSameOrigin; คืนผลสำเร็จเฉพาะเมื่อข้อมูลตรงกฎที่ระบบยอมรับ */
export function assertSameOrigin(request: NextRequest): boolean {
  return isSameOrigin(request.headers.get("origin"), getAuthEnv().APP_URL);
}
/** ตรวจเงื่อนไขผ่าน isSameOrigin; คืนผลสำเร็จเฉพาะเมื่อข้อมูลตรงกฎที่ระบบยอมรับ */
export function isSameOrigin(origin: string | null, appUrl: string): boolean {
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(appUrl).origin; } catch { return false; }
}
