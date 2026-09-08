/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “admin property api” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { NextRequest } from "next/server";
import { propertyIdSchema } from "@/lib/domain/property-structure";
import { ApiError } from "@/lib/server/api";
import {
  requirePropertyAccess,
  requireRequestAuth,
  requireRole,
} from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import {
  getPropertySubscriptionAccess,
  requireSubscriptionWriteAccess,
} from "@/lib/server/subscription-guard";
import { setRequestActorContext } from "@/lib/server/request-context";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Admin Property” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - rawPropertyId: รหัสภายในของ raw Property
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireAdminProperty(
  request: NextRequest,
  rawPropertyId: string,
) {
  const parsed = propertyIdSchema.safeParse(rawPropertyId);
  if (!parsed.success) throw new ApiError(404, "ไม่พบหอพัก");

  const auth = await requireRequestAuth(request);
  requireRole(auth, "PROPERTY_ADMIN");
  requirePropertyAccess(auth, parsed.data);
  setRequestActorContext(request, { userId: auth.userId, propertyId: parsed.data });
  const property = await getDatabase().property.findUnique({
    where: { id: parsed.data },
    select: { isActive: true },
  });
  if (!property?.isActive) throw new ApiError(404, "ไม่พบหอพัก");
  const isReadRequest = request.method === "GET" || request.method === "HEAD";
  if (!isReadRequest) await requireSubscriptionWriteAccess(parsed.data);
  const subscriptionAccess = await getPropertySubscriptionAccess(parsed.data);
  return { auth, propertyId: parsed.data, subscriptionAccess };
}
