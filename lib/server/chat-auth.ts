/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “chat auth” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/server/api";
import { requireRequestAuth, requirePropertyAccess, requireRole } from "@/lib/server/auth";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getDatabase } from "@/lib/server/db";
import type { ConversationActor } from "@/lib/server/chat";

const idSchema = z.string().cuid();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Chat Id” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function parseChatId(value: string) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "ไม่พบข้อมูล");
  return parsed.data;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Owner Chat Actor” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - rawPropertyId: รหัสภายในของ raw Property
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireOwnerChatActor(request: NextRequest, rawPropertyId: string) {
  const propertyId = parseChatId(rawPropertyId);
  const auth = await requireRequestAuth(request);
  requireRole(auth, "PROPERTY_ADMIN");
  requirePropertyAccess(auth, propertyId);
  const property = await getDatabase().property.findFirst({
    where: {
      id: propertyId,
      isActive: true,
      memberships: { some: { userId: auth.userId } },
    },
    select: { id: true },
  });
  if (!property) throw new ApiError(404, "ไม่พบหอพัก");
  return { auth, actor: { userId: auth.userId, role: "PROPERTY_ADMIN", propertyId } satisfies ConversationActor };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Super Admin Chat Actor” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - rawPropertyId: รหัสภายในของ raw Property
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireSuperAdminChatActor(request: NextRequest, rawPropertyId: string) {
  const propertyId = parseChatId(rawPropertyId);
  const auth = await requireRequestAuth(request);
  requireRole(auth, "SUPER_ADMIN");
  if (!await getDatabase().property.count({ where: { id: propertyId } })) throw new ApiError(404, "ไม่พบหอพัก");
  return { auth, actor: { userId: auth.userId, role: "SUPER_ADMIN", propertyId } satisfies ConversationActor };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Tenant Chat Actor” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireTenantChatActor(request: NextRequest) {
  const { auth, occupancy } = await requireActiveTenant(request);
  return {
    auth,
    occupancy,
    actor: {
      userId: auth.userId,
      role: "TENANT",
      propertyId: occupancy.propertyId,
      tenantProfileId: auth.tenantProfileId,
    } satisfies ConversationActor,
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Chat Actor For Property” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - rawPropertyId: รหัสภายในของ raw Property
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireChatActorForProperty(request: NextRequest, rawPropertyId: string) {
  const auth = await requireRequestAuth(request);
  if (auth.role === "TENANT") {
    const result = await requireTenantChatActor(request);
    if (result.actor.propertyId !== rawPropertyId) throw new ApiError(404, "ไม่พบข้อมูล");
    return result.actor;
  }
  if (auth.role === "SUPER_ADMIN") return (await requireSuperAdminChatActor(request, rawPropertyId)).actor;
  return (await requireOwnerChatActor(request, rawPropertyId)).actor;
}
