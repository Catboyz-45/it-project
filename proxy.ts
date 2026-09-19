
import { NextRequest, NextResponse } from "next/server";

// ทำงานก่อนทุกคำขอที่เข้า /api ติดรหัสประจำคำขอให้ทุกใบ เวลาไล่ log จะได้ตามรอยได้ว่าเป็นคำขอเดียวกัน
export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  // Headers ของคำขอเดิมแก้ตรง ๆ ไม่ได้ ต้องก๊อปออกมาเป็นชุดใหม่ก่อน
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // ใส่กลับไปในคำตอบด้วย ผู้ใช้แจ้งปัญหามาพร้อมรหัสนี้แล้วเราหา log เจอทันที
  response.headers.set("x-request-id", requestId);
  return response;
}

// จำกัดให้ทำงานเฉพาะเส้นทาง API หน้าเว็บธรรมดาไม่ต้องเสียเวลาผ่านตรงนี้
export const config = {
  matcher: ["/api/:path*"],
};
