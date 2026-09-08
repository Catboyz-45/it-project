/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “tenant onboarding” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type {
  AcceptTenantInvitationInput,
  CreateInvitationInput,
  ReviewOccupancyInput,
  TenantRegistrationInput,
} from "@/lib/domain/tenant-onboarding";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { hashPassword } from "@/lib/server/password";
import { recordRequiredPolicies } from "@/lib/server/legal-policies";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";
import { assertSubscriptionWriteAccess } from "@/lib/server/subscription-guard";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “hash Code” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - code: ค่า “code” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “reserve Invitation” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - database: ตัวเชื่อมต่อฐานข้อมูลที่ใช้ใน transaction นี้
 * - invitationCode: ค่า “invitation Code” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function reserveInvitation(
  database: Prisma.TransactionClient,
  invitationCode: string,
) {
  const invitation = await database.tenantInvitation.findUnique({
    where: { tokenHash: hashCode(invitationCode) },
    select: {
      id: true,
      propertyId: true,
      roomId: true,
      intendedRole: true,
      status: true,
      expiresAt: true,
      property: {
        select: {
          subscription: {
            select: {
              status: true,
              startsAt: true,
              expiresAt: true,
              maxProperties: true,
              maxRooms: true,
              plan: {
                select: {
                  allowPromptPay: true,
                  allowFileUploads: true,
                  allowPrioritySupport: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
    throw new ApiError(400, "รหัสเชิญไม่ถูกต้องหรือหมดอายุ");
  }
  assertSubscriptionWriteAccess(
    invitation.property.subscription,
    new Date(),
    getServerEnv().SUBSCRIPTION_GRACE_PERIOD_DAYS,
  );
  const reservation = await database.tenantInvitation.updateMany({
    where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  if (reservation.count !== 1) throw new ApiError(400, "รหัสเชิญถูกใช้งานแล้ว");
  const room = await database.room.findUnique({
    where: { id: invitation.roomId },
    select: {
      capacity: true,
      _count: { select: { occupancies: { where: { status: { in: ["PENDING", "ACTIVE"] } } } } },
    },
  });
  if (!room || room._count.occupancies >= room.capacity) {
    throw new ApiError(409, "จำนวนผู้พักถึงความจุห้องแล้ว");
  }
  if (invitation.intendedRole === "PRIMARY" && await database.roomOccupancy.count({
    where: { roomId: invitation.roomId, role: "PRIMARY", status: { in: ["PENDING", "ACTIVE"] } },
  })) {
    throw new ApiError(409, "ห้องนี้มีผู้เช่าหลักแล้ว");
  }
  return invitation;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Invitations” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listInvitations(propertyId: string, pagination: PaginationInput) {
  const rows = await getDatabase().tenantInvitation.findMany({
    where: { propertyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, status: true, intendedRole: true, expiresAt: true,
      acceptedAt: true, createdAt: true,
      room: { select: { id: true, number: true } },
      acceptedBy: { select: { user: { select: { displayName: true, email: true } } } },
    },
  });
  return toPaginatedResult(rows, pagination);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Pending Occupancies” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listPendingOccupancies(propertyId: string, pagination: PaginationInput) {
  const rows = await getDatabase().roomOccupancy.findMany({
    where: { propertyId, status: "PENDING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, role: true, status: true, createdAt: true,
      room: { select: { id: true, number: true } },
      tenantProfile: {
        select: {
          phone: true,
          user: { select: { displayName: true, email: true } },
        },
      },
    },
  });
  return toPaginatedResult(rows, pagination);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Invitation” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - createdByUserId: รหัสภายในของ created By User
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function createInvitation(
  propertyId: string,
  createdByUserId: string,
  input: CreateInvitationInput,
) {
  const code = randomBytes(32).toString("base64url");
  const invitation = await getDatabase().$transaction(async (database) => {
    const room = await database.room.findFirst({
      where: { id: input.roomId, propertyId, status: { in: ["AVAILABLE", "OCCUPIED"] } },
      select: { id: true, capacity: true, _count: { select: { occupancies: { where: { status: { in: ["PENDING", "ACTIVE"] } } } } } },
    });
    if (!room) throw new ApiError(404, "ไม่พบห้องที่รับผู้เช่าได้");
    if (room._count.occupancies >= room.capacity) throw new ApiError(409, "จำนวนผู้พักถึงความจุห้องแล้ว");
    if (input.intendedRole === "PRIMARY") {
      const primary = await database.roomOccupancy.count({
        where: { roomId: room.id, role: "PRIMARY", status: { in: ["PENDING", "ACTIVE"] } },
      });
      if (primary > 0) throw new ApiError(409, "ห้องนี้มีผู้เช่าหลักแล้ว");
    }
    return database.tenantInvitation.create({
      data: {
        propertyId, roomId: room.id, tokenHash: hashCode(code),
        intendedRole: input.intendedRole,
        expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000),
        createdByUserId,
      },
      select: { id: true, status: true, intendedRole: true, expiresAt: true, room: { select: { number: true } } },
    });
  });
  return { invitation, invitationCode: code };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “register Tenant” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function registerTenant(input: TenantRegistrationInput) {
  const passwordHash = await hashPassword(input.password);
  return getDatabase().$transaction(async (database) => {
    if (await database.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      throw new ApiError(409, "ไม่สามารถใช้อีเมลนี้ได้");
    }
    const invitation = await reserveInvitation(database, input.invitationCode);

    const user = await database.user.create({
      data: {
        email: input.email, passwordHash, displayName: input.displayName,
        role: "TENANT",
        approvalStatus: "APPROVED",
        tenantProfile: { create: { phone: input.phone } },
      },
      select: { id: true, tenantProfile: { select: { id: true } } },
    });
    if (!user.tenantProfile) throw new ApiError(500, "ไม่สามารถสร้างข้อมูลผู้เช่าได้");
    await recordRequiredPolicies(user.id, {
      action: "accept-required",
      termsAccepted: input.termsAccepted,
      privacyAcknowledged: input.privacyAcknowledged,
      marketingConsent: input.marketingConsent,
    }, "REGISTRATION", undefined, database);
    const occupancy = await database.roomOccupancy.create({
      data: {
        propertyId: invitation.propertyId, roomId: invitation.roomId,
        tenantProfileId: user.tenantProfile.id, role: invitation.intendedRole,
      },
      select: { id: true, status: true },
    });
    await database.tenantInvitation.update({
      where: { id: invitation.id },
      data: { acceptedById: user.tenantProfile.id },
    });
    return { userId: user.id, occupancy };
  }, { isolationLevel: "Serializable" });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “accept Tenant Invitation” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function acceptTenantInvitation(
  tenantProfileId: string,
  input: AcceptTenantInvitationInput,
) {
  return getDatabase().$transaction(async (database) => {
    const invitation = await reserveInvitation(database, input.invitationCode);
    const existing = await database.roomOccupancy.findFirst({
      where: {
        roomId: invitation.roomId,
        tenantProfileId,
        status: { in: ["PENDING", "ACTIVE"] },
      },
      select: { id: true },
    });
    if (existing) throw new ApiError(409, "บัญชีนี้มีคำขอหรือการเข้าพักในห้องนี้แล้ว");
    const occupancy = await database.roomOccupancy.create({
      data: {
        propertyId: invitation.propertyId,
        roomId: invitation.roomId,
        tenantProfileId,
        role: invitation.intendedRole,
      },
      select: {
        id: true, status: true, role: true,
        room: { select: { number: true } },
        property: { select: { id: true, name: true } },
      },
    });
    await database.tenantInvitation.update({
      where: { id: invitation.id },
      data: { acceptedById: tenantProfileId },
    });
    return occupancy;
  }, { isolationLevel: "Serializable" });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “review Occupancy” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - occupancyId: รหัสภายในของ occupancy
 * - reviewedByUserId: รหัสภายในของ reviewed By User
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function reviewOccupancy(
  propertyId: string,
  occupancyId: string,
  reviewedByUserId: string,
  input: ReviewOccupancyInput,
) {
  return getDatabase().$transaction(async (database) => {
    const occupancy = await database.roomOccupancy.findFirst({
      where: { id: occupancyId, propertyId, status: "PENDING" },
      select: { id: true, roomId: true, role: true },
    });
    if (!occupancy) throw new ApiError(404, "ไม่พบคำขอที่รออนุมัติ");
    if (input.status === "ACTIVE" && occupancy.role === "PRIMARY") {
      const existing = await database.roomOccupancy.count({
        where: { roomId: occupancy.roomId, role: "PRIMARY", status: "ACTIVE", id: { not: occupancy.id } },
      });
      if (existing > 0) throw new ApiError(409, "ห้องนี้มีผู้เช่าหลักแล้ว");
    }
    const updated = await database.roomOccupancy.update({
      where: { id: occupancy.id },
      data: {
        status: input.status,
        approvedAt: new Date(),
        approvedByUserId: reviewedByUserId,
        ...(input.status === "ACTIVE" ? { startedAt: new Date() } : { endedAt: new Date() }),
      },
      select: { id: true, status: true, role: true, roomId: true },
    });
    if (input.status === "ACTIVE") {
      await database.room.update({ where: { id: occupancy.roomId }, data: { status: "OCCUPIED" } });
    }
    return updated;
  }, { isolationLevel: "Serializable" });
}
