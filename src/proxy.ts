/**
 * หน้าที่ของไฟล์นี้: ด่านหน้าของ Next.js ที่จัดการคำขอก่อนถึงหน้าเป้าหมาย เช่น ตรวจเส้นทางและส่วนหัวด้านความปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/** ฟังก์ชันสาธารณะ proxy เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 128) || randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  if (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/api/admin")) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
