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

// ด่านตรวจของทุก API ฝั่งเจ้าของหอ ตรวจครบทุกชั้นก่อนปล่อยให้แตะข้อมูล
// route ทุกเส้นเรียกตัวนี้เป็นอย่างแรก จะได้ไม่มีเส้นไหนลืมตรวจ
export async function requireAdminProperty(
  request: NextRequest,
  rawPropertyId: string,
) {
  const parsed = propertyIdSchema.safeParse(rawPropertyId);
  // id รูปแบบผิดตอบว่าไม่พบ ไม่ใช่บอกว่ารูปแบบผิด เพราะแบบหลังช่วยให้เดาได้ว่าหอไหนมีอยู่จริง
  if (!parsed.success) throw new ApiError(404, "ไม่พบหอพัก");

  const auth = await requireRequestAuth(request);
  requireRole(auth, "PROPERTY_ADMIN");
  requirePropertyAccess(auth, parsed.data);
  // ฝากไว้กับคำขอ เพื่อให้ audit log กับตัวจำกัดจำนวนคำขอหยิบไปใช้ได้โดยไม่ต้องส่งต่อเป็นพารามิเตอร์
  setRequestActorContext(request, { userId: auth.userId, propertyId: parsed.data });
  const property = await getDatabase().property.findUnique({
    where: { id: parsed.data },
    select: { isActive: true },
  });
  // หอที่ถูกปิดใช้งานก็ถือว่าไม่พบ ไม่ใช่บอกว่ามีอยู่แต่เข้าไม่ได้
  if (!property?.isActive) throw new ApiError(404, "ไม่พบหอพัก");
  // แพ็กเกจหมดอายุยังอ่านข้อมูลเดิมได้ แต่แก้ไขไม่ได้ จึงตรวจเฉพาะคำขอที่เปลี่ยนข้อมูล
  // นี่คือด่านบังคับจริง ส่วนการซ่อนปุ่มในหน้าจอเป็นแค่การบอกผู้ใช้ให้รู้ตัวก่อน
  const isReadRequest = request.method === "GET" || request.method === "HEAD";
  if (!isReadRequest) await requireSubscriptionWriteAccess(parsed.data);
  const subscriptionAccess = await getPropertySubscriptionAccess(parsed.data);
  return { auth, propertyId: parsed.data, subscriptionAccess };
}
