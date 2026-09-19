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

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

// จองรหัสเชิญ ทำสามอย่างตามลำดับ ตรวจว่ารหัสใช้ได้ ปิดรหัสทันที แล้วค่อยเช็คว่าห้องยังรับได้
// ปิดรหัสก่อนเช็คห้อง เพราะคนสองคนที่ถือรหัสเดียวกันต้องผ่านได้แค่คนเดียว
async function reserveInvitation(
  database: Prisma.TransactionClient,
  invitationCode: string,
) {
  // ค้นด้วยค่า hash เพราะฐานข้อมูลไม่ได้เก็บรหัสจริง ฐานข้อมูลรั่วก็เอารหัสไปใช้ไม่ได้
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
  // ตรวจสามอย่างรวดเดียว ข้อความเหมือนกันหมด ไม่บอกว่าติดข้อไหน จะได้ไม่ช่วยให้เดารหัส
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) {
    throw new ApiError(400, "รหัสเชิญไม่ถูกต้องหรือหมดอายุ");
  }
  // แพ็กเกจของหอหมดอายุก็รับผู้เช่าใหม่ไม่ได้ ตรวจตรงนี้ก่อนเสียเวลาสร้างบัญชี
  assertSubscriptionWriteAccess(
    invitation.property.subscription,
    new Date(),
    getServerEnv().SUBSCRIPTION_GRACE_PERIOD_DAYS,
  );
  // ใส่เงื่อนไขไว้ใน where แล้วนับจำนวนแถวที่แก้ได้ จึงไม่มีช่องว่างระหว่างอ่านกับเขียน
  // คนสองคนกดพร้อมกันจะมีแค่คนเดียวที่ได้ 1 แถว อีกคนได้ 0
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
  // นับทั้งที่รออนุมัติและที่อยู่จริง ไม่งั้นจะเชิญเกินความจุได้ด้วยคำขอที่ยังค้างอยู่
  if (!room || room._count.occupancies >= room.capacity) {
    throw new ApiError(409, "จำนวนผู้พักถึงความจุห้องแล้ว");
  }
  // ห้องหนึ่งมีผู้เช่าหลักได้คนเดียว เพราะเป็นคนที่ชื่ออยู่บนสัญญาและรับบิล
  if (invitation.intendedRole === "PRIMARY" && await database.roomOccupancy.count({
    where: { roomId: invitation.roomId, role: "PRIMARY", status: { in: ["PENDING", "ACTIVE"] } },
  })) {
    throw new ApiError(409, "ห้องนี้มีผู้เช่าหลักแล้ว");
  }
  return invitation;
}

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

// สมัครเป็นผู้เช่า สร้างบัญชี โปรไฟล์ และคำขอเข้าพักในคำสั่งเดียว
export async function registerTenant(input: TenantRegistrationInput) {
  // เข้ารหัสไว้ก่อนเข้า transaction เพราะ scrypt ตั้งใจให้ช้า ไม่ควรถือ transaction ค้างไว้ระหว่างนั้น
  const passwordHash = await hashPassword(input.password);
  return getDatabase().$transaction(async (database) => {
    if (await database.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      // ข้อความกลาง ๆ ไม่บอกว่าอีเมลนี้มีคนใช้แล้ว เพราะเท่ากับยืนยันว่ามีบัญชีนั้นอยู่ในระบบ
      throw new ApiError(409, "ไม่สามารถใช้อีเมลนี้ได้");
    }
    const invitation = await reserveInvitation(database, input.invitationCode);

    const user = await database.user.create({
      data: {
        email: input.email, passwordHash, displayName: input.displayName,
        role: "TENANT",
        // ผู้เช่าไม่ต้องรอผู้ดูแลระบบอนุมัติบัญชี เพราะได้รับเชิญจากเจ้าของหอมาแล้ว
        // แต่การเข้าพักยังเป็น PENDING รอเจ้าของหอตรวจอีกที
        approvalStatus: "APPROVED",
        tenantProfile: { create: { phone: input.phone } },
      },
      select: { id: true, tenantProfile: { select: { id: true } } },
    });
    if (!user.tenantProfile) throw new ApiError(500, "ไม่สามารถสร้างข้อมูลผู้เช่าได้");
    // เก็บหลักฐานการยอมรับข้อกำหนดไว้ใน transaction เดียวกัน จะได้ไม่มีบัญชีที่ไม่มีบันทึกความยินยอม
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
  // Serializable เพราะอ่านแล้วเขียนหลายตาราง ยอมให้คำขอสองอันทำงานสลับกันจนผลเพี้ยนไม่ได้
  }, { isolationLevel: "Serializable" });
}

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
    // กันรับคำเชิญซ้ำห้องเดิม ไม่งั้นคนเดียวจะมีหลายรายการในห้องเดียว
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

// เจ้าของหออนุมัติหรือปฏิเสธคำขอเข้าพัก
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
      // เช็คอีกรอบตอนอนุมัติ เพราะระหว่างที่คำขอรออยู่ อาจมีคนอื่นถูกอนุมัติเป็นผู้เช่าหลักไปแล้ว
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
