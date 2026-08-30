/**
 * หน้าที่ของไฟล์นี้: API /api/auth/logout รองรับ POST; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/auth/audit";
import {
  getSessionByToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/auth/session";
import { assertSameOrigin, requestContext } from "@/server/security/request";

/** จุดเริ่มของคำขอ HTTP POST: สร้างข้อมูลหรือสั่งให้เกิดการทำงาน และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request))
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });

  const session = await getSessionByToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (session) {
    await db.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
    });
    await audit({
      actorId: session.adminId,
      action: "AUTH_LOGOUT",
      targetType: "AdminSession",
      targetId: session.id,
      result: "SUCCESS",
      ...requestContext(request),
    });
  }

  const response = NextResponse.json({ next: "/login" });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
