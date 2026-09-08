/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “auth” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/generated/prisma/client";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { requireSubscriptionWriteAccess } from "@/lib/server/subscription-guard";
import { setRequestActorContext } from "@/lib/server/request-context";
import { hasAcceptedRequiredPolicies } from "@/lib/server/legal-policies";

export const sessionCookieName = "dorm_session";
const sessionLifetimeMs = 8 * 60 * 60 * 1000;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Auth Context” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type AuthContext = {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword?: boolean;
  propertyIds: string[];
  tenantProfileId?: string;
  tenantOccupancies?: Array<{
    occupancyId: string;
    propertyId: string;
    roomId: string;
    role: "PRIMARY" | "CO_OCCUPANT";
    status: "PENDING" | "ACTIVE";
  }>;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “hash Token” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - token: ค่า “token” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “resolve Session” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - token: ค่า “token” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<AuthContext | null> ตามสัญญา TypeScript ของฟังก์ชัน
 */
async function resolveSession(token: string | undefined): Promise<AuthContext | null> {
  if (!token) return null;
  const session = await getDatabase().session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isActive: true,
          approvalStatus: true,
          mustChangePassword: true,
          memberships: {
            where: { property: { isActive: true } },
            select: { propertyId: true },
          },
          tenantProfile: {
            select: {
              id: true,
              occupancies: {
                where: { status: { in: ["PENDING", "ACTIVE"] } },
                select: { id: true, propertyId: true, roomId: true, role: true, status: true },
              },
            },
          },
        },
      },
    },
  });
  if (!session || !session.user.isActive || session.user.approvalStatus !== "APPROVED" || session.expiresAt <= new Date()) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
    mustChangePassword: session.user.mustChangePassword,
    propertyIds: session.user.memberships.map(({ propertyId }) => propertyId),
    tenantProfileId: session.user.tenantProfile?.id,
    tenantOccupancies: session.user.tenantProfile?.occupancies.map((occupancy) => ({
      occupancyId: occupancy.id,
      propertyId: occupancy.propertyId,
      roomId: occupancy.roomId,
      role: occupancy.role,
      status: occupancy.status as "PENDING" | "ACTIVE",
    })),
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Request Auth” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getRequestAuth(request: NextRequest) {
  return resolveSession(request.cookies.get(sessionCookieName)?.value);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Page Auth” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getPageAuth() {
  return resolveSession((await cookies()).get(sessionCookieName)?.value);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Request Auth” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireRequestAuth(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
  setRequestActorContext(request, { userId: auth.userId });
  if (auth.mustChangePassword) throw new ApiError(403, "กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งาน");
  if (!await hasAcceptedRequiredPolicies(auth.userId)) throw new ApiError(428, "กรุณายืนยันข้อกำหนดและประกาศความเป็นส่วนตัวก่อนใช้งาน");
  return auth;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Page Auth” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requirePageAuth() {
  const auth = await getPageAuth();
  if (!auth) redirect("/login");
  if (auth.mustChangePassword) redirect("/change-password");
  if (!await hasAcceptedRequiredPolicies(auth.userId)) redirect("/legal/accept");
  return auth;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Role” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - auth: ค่า “auth” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - role: ค่า “role” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export function requireRole(auth: AuthContext, role: UserRole) {
  if (auth.role !== role) throw new ApiError(403, "คุณไม่มีสิทธิ์ดำเนินการ");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Property Access” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - auth: ค่า “auth” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export function requirePropertyAccess(auth: AuthContext, propertyId: string) {
  if (auth.role !== "SUPER_ADMIN" && !auth.propertyIds.includes(propertyId)) {
    throw new ApiError(404, "ไม่พบข้อมูล");
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Request Property” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - options: ตัวเลือกเพิ่มเติมที่ปรับพฤติกรรมของฟังก์ชัน
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireRequestProperty(
  request: NextRequest,
  options: { requireWriteAccess?: boolean } = {},
) {
  const auth = await requireRequestAuth(request);
  const propertyId = request.nextUrl.searchParams.get("propertyId") || request.headers.get("x-property-id");
  if (!propertyId || !/^[a-z0-9_-]{10,40}$/i.test(propertyId)) throw new ApiError(400, "กรุณาระบุหอพัก");
  setRequestActorContext(request, { userId: auth.userId, propertyId });
  requirePropertyAccess(auth, propertyId);
  const requireWriteAccess = options.requireWriteAccess
    ?? (request.method !== "GET" && request.method !== "HEAD");
  if (requireWriteAccess) {
    await requireSubscriptionWriteAccess(propertyId);
  }
  return { auth, propertyId };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Session” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function createSession(userId: string, response: NextResponse) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await getDatabase().$transaction([
    getDatabase().session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }),
    getDatabase().session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } }),
  ]);
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “revoke Session” ตามกฎของระบบ
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function revokeSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (token) await getDatabase().session.deleteMany({ where: { tokenHash: hashToken(token) } });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “revoke All Sessions” ตามกฎของระบบ
 * รับค่า:
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function revokeAllSessions(userId: string, response: NextResponse) {
  await getDatabase().session.deleteMany({ where: { userId } });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
