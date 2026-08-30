/**
 * หน้าที่ของไฟล์นี้: API /api/admin/account รองรับ GET, PATCH; ตรวจสอบคำขอ เรียกกฎฝั่งเซิร์ฟเวอร์ และส่งผลลัพธ์ JSON โดยไม่เปิดเผยข้อมูลภายใน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/server/auth/audit";
import { currentSession, revokeUserSessions, rotateSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/security/crypto";
import { assertSameOrigin, requestContext } from "@/server/security/request";

const profileSchema = z.object({ type: z.literal("profile"), displayName: z.string().trim().min(1).max(160) }).strict();
const passwordChangeSchema = z.object({
  type: z.literal("password"),
  currentPassword: z.string().min(1).max(200),
  password: z.string().min(12).max(200).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/),
  confirm: z.string().max(200),
}).strict().refine(value => value.password === value.confirm, { path: ["confirm"] });
const schema = z.union([profileSchema, passwordChangeSchema]);

/** จุดเริ่มของคำขอ HTTP GET: อ่านข้อมูลโดยไม่แก้ไขข้อมูล และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function GET() {
  const session = await currentSession();
  if (!session?.twoFactorAt) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ user: { displayName: session.admin.displayName, username: session.admin.username, role: session.admin.role, twoFactorEnabled: session.admin.twoFactorEnabled } }, { headers: { "Cache-Control": "no-store" } });
}

/** จุดเริ่มของคำขอ HTTP PATCH: แก้เฉพาะช่องที่ส่งมา และคืนสถานะที่เหมาะสมให้ผู้เรียก */
export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 });
  const session = await currentSession();
  if (!session?.twoFactorAt) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const context = requestContext(request);

  if (parsed.data.type === "profile") {
    await db.admin.update({ where: { id: session.adminId }, data: { displayName: parsed.data.displayName } });
    await audit({ actorId: session.adminId, action: "ADMIN_SELF_PROFILE_UPDATED", targetType: "Admin", targetId: session.adminId, result: "SUCCESS", ...context });
    return NextResponse.json({ success: true });
  }

  if (!await verifyPassword(session.admin.passwordHash, parsed.data.currentPassword)) {
    await audit({ actorId: session.adminId, action: "ADMIN_SELF_PASSWORD_CHANGED", targetType: "Admin", targetId: session.adminId, result: "FAILURE", ...context });
    return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
  }
  const passwordHash = await hashPassword(parsed.data.password);
  await db.admin.update({ where: { id: session.adminId }, data: { passwordHash } });
  await revokeUserSessions(session.adminId, session.id);
  const token = await rotateSession(session.id, "TWO_FACTOR_VERIFIED");
  await audit({ actorId: session.adminId, action: "ADMIN_SELF_PASSWORD_CHANGED", targetType: "Admin", targetId: session.adminId, result: "SUCCESS", ...context });
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: session.expiresAt });
  return response;
}
