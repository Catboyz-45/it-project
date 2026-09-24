import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/server/api";
import { requireRequestAuth, requirePropertyAccess, requireRole } from "@/lib/server/auth";
import { requireActiveTenant } from "@/lib/server/tenant-auth";
import { getDatabase } from "@/lib/server/db";
import type { ConversationActor } from "@/lib/server/chat";

const idSchema = z.cuid();

// id รูปแบบผิดตอบว่าไม่พบ ไม่ใช่บอกว่ารูปแบบผิด เพราะแบบหลังช่วยให้เดาได้ว่าข้อมูลมีอยู่จริงไหม
export function parseChatId(value: string) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "ไม่พบข้อมูล");
  return parsed.data;
}

// เจ้าของหอต้องผ่านสามด่าน เป็นผู้ดูแลหอ มีสิทธิ์ในหอนี้ และหอนี้ยังเปิดใช้งานอยู่
export async function requireOwnerChatActor(request: NextRequest, rawPropertyId: string) {
  const propertyId = parseChatId(rawPropertyId);
  const auth = await requireRequestAuth(request);
  requireRole(auth, "PROPERTY_ADMIN");
  requirePropertyAccess(auth, propertyId);
  const property = await getDatabase().property.findFirst({
    where: {
      id: propertyId,
      isActive: true,
      // เช็คสิทธิ์ซ้ำในคำสั่งฐานข้อมูลด้วย ไม่พึ่งแค่ค่าที่อ่านมาจาก session
      memberships: { some: { userId: auth.userId } },
    },
    select: { id: true },
  });
  if (!property) throw new ApiError(404, "ไม่พบหอพัก");
  return { auth, actor: { userId: auth.userId, role: "PROPERTY_ADMIN", propertyId } satisfies ConversationActor };
}

// ผู้ดูแลระบบเข้าได้ทุกหอ รวมถึงหอที่ปิดใช้งานแล้ว เพราะต้องช่วยเรื่องต่ออายุแพ็กเกจได้
export async function requireSuperAdminChatActor(request: NextRequest, rawPropertyId: string) {
  const propertyId = parseChatId(rawPropertyId);
  const auth = await requireRequestAuth(request);
  requireRole(auth, "SUPER_ADMIN");
  if (!await getDatabase().property.count({ where: { id: propertyId } })) throw new ApiError(404, "ไม่พบหอพัก");
  return { auth, actor: { userId: auth.userId, role: "SUPER_ADMIN", propertyId } satisfies ConversationActor };
}

// ผู้เช่าคุยได้เฉพาะหอที่ตัวเองพักอยู่จริงในตอนนี้ ไม่ต้องส่ง propertyId มา ระบบดูจากการเข้าพัก
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

// เลือกวิธีตรวจตามบทบาท ใช้กับ endpoint ที่เปิดให้ทั้งสามฝ่ายเรียกได้
export async function requireChatActorForProperty(request: NextRequest, rawPropertyId: string) {
  const auth = await requireRequestAuth(request);
  if (auth.role === "TENANT") {
    const result = await requireTenantChatActor(request);
    // ผู้เช่าขอหอที่ไม่ใช่ของตัวเองก็ตอบว่าไม่พบ ไม่บอกว่าหอนั้นมีอยู่แต่เข้าไม่ได้
    if (result.actor.propertyId !== rawPropertyId) throw new ApiError(404, "ไม่พบข้อมูล");
    return result.actor;
  }
  if (auth.role === "SUPER_ADMIN") return (await requireSuperAdminChatActor(request, rawPropertyId)).actor;
  return (await requireOwnerChatActor(request, rawPropertyId)).actor;
}
