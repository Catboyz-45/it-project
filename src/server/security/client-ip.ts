/**
 * หน้าที่ของไฟล์นี้: กลไกความปลอดภัย client-ip สำหรับตรวจคำขอ เข้ารหัส หรือยืนยันข้อมูลสำคัญก่อนระบบเชื่อถือ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { isIP } from "node:net";

const MAX_FORWARDED_FOR_LENGTH = 2_048;
const MAX_PROXY_CHAIN_LENGTH = 32;

/**
 * Resolves the client address only when the deployment explicitly declares how
 * many reverse-proxy hops it controls. Entries supplied farther to the left by
 * a client are ignored by selecting from the trusted, right-hand side.
 */
/** แปลงหรือจัดรูปข้อมูลด้วย resolveForwardedClientIp ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function resolveForwardedClientIp(
  forwardedFor: string | null,
  trustedProxyHops: number,
): string | null {
  if (
    trustedProxyHops < 1 ||
    !forwardedFor ||
    forwardedFor.length > MAX_FORWARDED_FOR_LENGTH
  ) {
    return null;
  }

  const chain = forwardedFor.split(",").map((entry) => entry.trim());
  if (
    chain.length > MAX_PROXY_CHAIN_LENGTH ||
    chain.length < trustedProxyHops ||
    chain.some((entry) => isIP(entry) === 0)
  ) {
    return null;
  }

  return chain[chain.length - trustedProxyHops] ?? null;
}
