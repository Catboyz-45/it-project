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

// session อยู่ได้ 8 ชั่วโมง พอดีกับหนึ่งวันทำงาน หมดแล้วต้องเข้าใหม่
export const sessionCookieName = "dorm_session";
const sessionLifetimeMs = 8 * 60 * 60 * 1000;

// ข้อมูลผู้ใช้ที่อ่านมาจาก session ทุกที่ที่ตรวจสิทธิ์ใช้ก้อนนี้
export type AuthContext = {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword?: boolean;
  // หอที่บัญชีนี้ดูแลได้ ว่างเปล่าสำหรับผู้เช่าและผู้ดูแลระบบ
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

// ฐานข้อมูลเก็บแต่ค่า hash ของโทเคน ฐานข้อมูลรั่วก็เอาไปสวมรอยเข้าระบบไม่ได้
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// แปลงโทเคนในคุกกี้เป็นข้อมูลผู้ใช้ อ่านจากฐานข้อมูลทุกครั้ง ไม่ได้เก็บอะไรไว้ในคุกกี้เอง
// จึงถอนสิทธิ์ได้ทันทีโดยไม่ต้องรอ session หมดอายุ
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
          // เอาเฉพาะหอที่ยังเปิดใช้งาน หอที่ถูกปิดจะหลุดจากสิทธิ์ทันที
          memberships: {
            where: { property: { isActive: true } },
            select: { propertyId: true },
          },
          tenantProfile: {
            select: {
              id: true,
              occupancies: {
                // รวมที่ยังรออนุมัติด้วย เพราะต้องแสดงหน้ารอตรวจสอบให้ผู้เช่าเห็น
                where: { status: { in: ["PENDING", "ACTIVE"] } },
                select: { id: true, propertyId: true, roomId: true, role: true, status: true },
              },
            },
          },
        },
      },
    },
  });
  // ตรวจสี่อย่างพร้อมกัน มี session จริง บัญชียังใช้งานได้ ผ่านอนุมัติแล้ว และยังไม่หมดอายุ
  // ทั้งหมดคืน null เหมือนกัน ไม่แยกสาเหตุ เพราะไม่ควรบอกผู้เรียกว่าติดข้อไหน
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

export async function getRequestAuth(request: NextRequest) {
  return resolveSession(request.cookies.get(sessionCookieName)?.value);
}

export async function getPageAuth() {
  return resolveSession((await cookies()).get(sessionCookieName)?.value);
}

// ด่านตรวจของ API ไม่ผ่านจะโยน ApiError ที่กลายเป็นคำตอบ HTTP ที่เหมาะสม
export async function requireRequestAuth(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
  // ฝากไว้กับคำขอ ให้ audit log กับตัวจำกัดจำนวนคำขอหยิบไปใช้ได้โดยไม่ต้องส่งต่อเป็นพารามิเตอร์
  setRequestActorContext(request, { userId: auth.userId });
  // ยังไม่เปลี่ยนรหัสชั่วคราวก็ใช้อะไรไม่ได้ กันรหัสที่ผู้ดูแลระบบออกให้ถูกใช้ต่อไปเรื่อย ๆ
  if (auth.mustChangePassword) throw new ApiError(403, "กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งาน");
  // 428 คือรหัสที่แปลว่าต้องทำอะไรบางอย่างก่อน เหมาะกับกรณีข้อกำหนดถูกแก้แล้วยังไม่ได้ยอมรับใหม่
  if (!await hasAcceptedRequiredPolicies(auth.userId)) throw new ApiError(428, "กรุณายืนยันข้อกำหนดและประกาศความเป็นส่วนตัวก่อนใช้งาน");
  return auth;
}

// ด่านตรวจของหน้าเว็บ ไม่ผ่านจะเปลี่ยนเส้นทางแทนการโยน error เพราะผู้ใช้กำลังเปิดหน้าอยู่
export async function requirePageAuth() {
  const auth = await getPageAuth();
  if (!auth) redirect("/login");
  if (auth.mustChangePassword) redirect("/change-password");
  if (!await hasAcceptedRequiredPolicies(auth.userId)) redirect("/legal/accept");
  return auth;
}

// เทียบบทบาทแบบตรงตัว ไม่มีลำดับชั้น ผู้ดูแลระบบจึงไม่ผ่านด่านที่ขอ PROPERTY_ADMIN
// ตั้งใจให้เป็นแบบนี้ เพราะสองบทบาททำงานคนละอย่างและใช้ข้อมูลคนละชุด
export function requireRole(auth: AuthContext, role: UserRole) {
  if (auth.role !== role) throw new ApiError(403, "คุณไม่มีสิทธิ์ดำเนินการ");
}

// ตอบ 404 ไม่ใช่ 403 โดยตั้งใจ บอกว่าไม่มีสิทธิ์เท่ากับยืนยันว่าหอนั้นมีอยู่จริง
// ซึ่งเป็นการรั่วข้อมูลว่าในระบบมีหออะไรบ้าง
export function requirePropertyAccess(auth: AuthContext, propertyId: string) {
  if (auth.role !== "SUPER_ADMIN" && !auth.propertyIds.includes(propertyId)) {
    throw new ApiError(404, "ไม่พบข้อมูล");
  }
}

export async function requireRequestProperty(
  request: NextRequest,
  options: { requireWriteAccess?: boolean } = {},
) {
  const auth = await requireRequestAuth(request);
  // รับ propertyId ได้ทั้งจาก query string และ header เพราะคำขอแบบอัปโหลดไฟล์ใส่ใน query ไม่สะดวก
  const propertyId = request.nextUrl.searchParams.get("propertyId") || request.headers.get("x-property-id");
  // ตรวจรูปแบบก่อนเอาไปใช้ เพราะค่านี้มาจากฝั่งผู้ใช้ทั้งดุ้น
  if (!propertyId || !/^[a-z0-9_-]{10,40}$/i.test(propertyId)) throw new ApiError(400, "กรุณาระบุหอพัก");
  setRequestActorContext(request, { userId: auth.userId, propertyId });
  requirePropertyAccess(auth, propertyId);
  // เดาจากเมท็อดว่าเป็นการอ่านหรือเขียน ผู้เรียกระบุเองได้ถ้าเป็นกรณีพิเศษ
  const requireWriteAccess = options.requireWriteAccess
    ?? (request.method !== "GET" && request.method !== "HEAD");
  if (requireWriteAccess) {
    await requireSubscriptionWriteAccess(propertyId);
  }
  return { auth, propertyId };
}

// สร้าง session ใหม่หลังเข้าสู่ระบบสำเร็จ
export async function createSession(userId: string, response: NextResponse) {
  // 32 ไบต์สุ่มจากตัวสร้างเลขสุ่มเชิงเข้ารหัส เดาไม่ได้ในทางปฏิบัติ
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  // ลบ session ที่หมดอายุแล้วของผู้ใช้คนนี้ทิ้งไปพร้อมกัน จะได้ไม่สะสมในตาราง
  await getDatabase().$transaction([
    getDatabase().session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }),
    getDatabase().session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } }),
  ]);
  // httpOnly กัน JavaScript อ่านคุกกี้ ต่อให้มี XSS ก็ขโมยโทเคนไปไม่ได้
  // secure เฉพาะตอน production เพราะตอน dev รันบน http ธรรมดา
  // sameSite lax กัน CSRF โดยไม่ทำให้การกดลิงก์จากภายนอกเข้าเว็บแล้วหลุด session
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// ออกจากระบบ ลบทั้งแถวในฐานข้อมูลและคุกกี้ ไม่ใช่ลบแค่คุกกี้ฝั่งเบราว์เซอร์
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

// ตัดทุกอุปกรณ์ ใช้หลังเปลี่ยนรหัสผ่านหรือถูกถอนสิทธิ์ เครื่องอื่นที่ค้างอยู่จะได้หลุดด้วย
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
