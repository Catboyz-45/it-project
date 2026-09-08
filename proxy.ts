/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นไฟล์ตั้งค่าหรือจุดเชื่อมระบบ “proxy” ของโปรเจกต์ Nestly
 * การทำงาน: กำหนดวิธีที่เครื่องมือ build, test หรือ runtime ทำงานร่วมกับโค้ดหลัก โดยไม่เก็บข้อมูลผู้ใช้งานจริง
 */

import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
