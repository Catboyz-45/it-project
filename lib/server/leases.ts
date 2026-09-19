import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { leaseStatusTransitions } from "@/lib/domain/enums";
import type { CreateLeaseInput, RenewLeaseInput, TransitionLeaseInput, UpdateLeaseInput } from "@/lib/domain/leases";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

// เลือกเฉพาะฟิลด์ที่หน้าจอใช้จริง รวมไว้ที่เดียวจะได้ตอบกลับรูปแบบเดียวกันทุก endpoint
const leaseSelect = {
  id: true, leaseNumber: true, status: true, startDate: true, endDate: true,
  monthlyRent: true, depositAmount: true, currentVersion: true,
  signedStorageKey: true, activatedAt: true, endedAt: true, createdAt: true, updatedAt: true,
  room: { select: { id: true, number: true } },
  tenants: {
    select: {
      isPrimary: true,
      occupancy: { select: { tenantProfile: { select: { id: true, user: { select: { displayName: true, email: true } } } } } },
    },
  },
  versions: { orderBy: { version: "desc" as const }, select: { id: true, version: true, documentId: true, signedStorageKey: true, createdAt: true } },
} as const;

// Prisma คืน Decimal มา แปลงเป็นสตริงก่อนส่งออกไป ส่งเป็น number ตรง ๆ จะปัดเศษเพี้ยน
const serialize = <T extends { monthlyRent: { toString(): string }; depositAmount: { toString(): string } }>(lease: T) => ({
  ...lease,
  monthlyRent: lease.monthlyRent.toString(),
  depositAmount: lease.depositAmount.toString(),
});

export async function listLeases(propertyId: string, pagination: PaginationInput, query?: string) {
  const normalizedQuery = query?.trim();
  const leases = await getDatabase().lease.findMany({
    where: {
      propertyId,
      ...(normalizedQuery ? {
        OR: [
          { leaseNumber: { contains: normalizedQuery, mode: "insensitive" } },
          { room: { number: { contains: normalizedQuery, mode: "insensitive" } } },
          { tenants: { some: { occupancy: { tenantProfile: { user: {
            OR: [
              { displayName: { contains: normalizedQuery, mode: "insensitive" } },
              { email: { contains: normalizedQuery, mode: "insensitive" } },
            ],
          } } } } } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination), select: leaseSelect,
  });
  return toPaginatedResult(leases.map(serialize), pagination);
}

export async function getLease(propertyId: string, leaseId: string) {
  const lease = await getDatabase().lease.findFirst({ where: { id: leaseId, propertyId }, select: leaseSelect });
  if (!lease) throw new ApiError(404, "ไม่พบสัญญา");
  return serialize(lease);
}

// สร้างสัญญาใหม่ เกิดเป็นร่างเสมอ ต้องไปเปลี่ยนสถานะทีหลังถึงจะมีผล
export async function createLease(propertyId: string, userId: string, input: CreateLeaseInput) {
  const lease = await getDatabase().$transaction(async (database) => {
    const occupancy = await database.roomOccupancy.findFirst({
      where: { propertyId, roomId: input.roomId, role: "PRIMARY", status: "ACTIVE" },
      select: {
        id: true,
        room: { select: { number: true } },
        tenantProfile: { select: { id: true, user: { select: { displayName: true, email: true } } } },
      },
    });
    // ต้องมีผู้เช่าหลักก่อน เพราะสัญญาต้องมีชื่อคนเซ็น
    if (!occupancy) throw new ApiError(409, "ห้องต้องมีผู้เช่าหลักที่อนุมัติแล้ว");
    const live = await database.lease.count({
      where: { roomId: input.roomId, status: { in: ["PENDING_SIGNATURE", "ACTIVE", "EXPIRING"] } },
    });
    // ห้องหนึ่งมีสัญญาที่ใช้งานอยู่ได้ฉบับเดียว ต้องปิดของเดิมก่อนหรือใช้การต่ออายุแทน
    if (live > 0) throw new ApiError(409, "ห้องนี้มีสัญญาที่ใช้งานอยู่");
    if (input.templateId) {
      const template = await database.documentTemplate.count({ where: { id: input.templateId, propertyId, kind: "CONTRACT" } });
      if (!template) throw new ApiError(400, "Template สัญญาไม่ถูกต้อง");
    }
    const leaseNumber = `CTR-${new Date().getFullYear()}-${occupancy.room.number}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const snapshot = {
      leaseNumber, roomNumber: occupancy.room.number,
      tenantProfileId: occupancy.tenantProfile.id,
      tenantName: occupancy.tenantProfile.user.displayName,
      tenantEmail: occupancy.tenantProfile.user.email,
      startDate: input.startDate.toISOString().slice(0, 10),
      endDate: input.endDate.toISOString().slice(0, 10),
      monthlyRent: input.monthlyRent,
      depositAmount: input.depositAmount,
    } satisfies Prisma.InputJsonObject;
    return database.lease.create({
      data: {
        propertyId, roomId: input.roomId, leaseNumber,
        startDate: input.startDate, endDate: input.endDate,
        monthlyRent: input.monthlyRent, depositAmount: input.depositAmount,
        tenants: { create: { occupancyId: occupancy.id, isPrimary: true } },
        versions: { create: { version: 1, templateId: input.templateId, snapshot, createdByUserId: userId } },
      },
      select: leaseSelect,
    });
  }, { isolationLevel: "Serializable" });
  return serialize(lease);
}

// ต่อสัญญา สร้างฉบับใหม่ต่อจากฉบับเดิม ไม่ได้แก้ฉบับเดิม ประวัติจะได้ครบ
export async function renewLease(propertyId: string, sourceLeaseId: string, userId: string, input: RenewLeaseInput) {
  const lease = await getDatabase().$transaction(async (database) => {
    const source = await database.lease.findFirst({
      where: { id: sourceLeaseId, propertyId, status: { in: ["ACTIVE", "EXPIRING", "EXPIRED"] } },
      select: {
        id: true,
        endDate: true,
        roomId: true,
        room: { select: { number: true } },
        tenants: {
          where: { isPrimary: true },
          select: { occupancy: { select: { id: true, status: true, tenantProfile: { select: { id: true, user: { select: { displayName: true, email: true } } } } } } },
        },
        versions: { orderBy: { version: "desc" }, take: 1, select: { templateId: true } },
      },
    });
    if (!source) throw new ApiError(404, "ไม่พบสัญญาที่ต่ออายุได้");
    // ฉบับใหม่ต้องเริ่มหลังฉบับเดิมจบ ไม่งั้นจะมีสองสัญญาคาบเกี่ยวกันในห้องเดียว
    if (input.startDate <= source.endDate) throw new ApiError(409, "สัญญาใหม่ต้องเริ่มหลังวันสิ้นสุดของสัญญาเดิม");
    const primary = source.tenants[0]?.occupancy;
    // คนเดิมย้ายออกไปแล้วก็ต่อสัญญาไม่ได้ ต้องทำสัญญาใหม่ให้คนใหม่แทน
    if (!primary || primary.status !== "ACTIVE") throw new ApiError(409, "ผู้เช่าหลักของสัญญานี้ไม่ได้พักอยู่ในห้องแล้ว");
    const overlapping = await database.lease.count({
      where: {
        id: { not: source.id },
        roomId: source.roomId,
        status: { in: ["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "EXPIRING"] },
        startDate: { lte: input.endDate },
        endDate: { gte: input.startDate },
      },
    });
    // เช็คซ้อนทับกับทุกสัญญาของห้อง ไม่ใช่แค่ฉบับที่กำลังต่อ เผื่อมีฉบับอื่นค้างอยู่
    if (overlapping > 0) throw new ApiError(409, "ช่วงวันที่นี้ซ้อนกับสัญญาอื่นของห้อง");
    const leaseNumber = `CTR-${input.startDate.getFullYear()}-${source.room.number}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const snapshot = {
      leaseNumber,
      renewedFromLeaseId: source.id,
      roomNumber: source.room.number,
      tenantProfileId: primary.tenantProfile.id,
      tenantName: primary.tenantProfile.user.displayName,
      tenantEmail: primary.tenantProfile.user.email,
      startDate: input.startDate.toISOString().slice(0, 10),
      endDate: input.endDate.toISOString().slice(0, 10),
      monthlyRent: input.monthlyRent,
      depositAmount: input.depositAmount,
    } satisfies Prisma.InputJsonObject;
    return database.lease.create({
      data: {
        propertyId,
        roomId: source.roomId,
        leaseNumber,
        startDate: input.startDate,
        endDate: input.endDate,
        monthlyRent: input.monthlyRent,
        depositAmount: input.depositAmount,
        tenants: { create: { occupancyId: primary.id, isPrimary: true } },
        versions: { create: { version: 1, templateId: source.versions[0]?.templateId, snapshot, createdByUserId: userId } },
      },
      select: leaseSelect,
    });
  }, { isolationLevel: "Serializable" });
  return serialize(lease);
}

export async function updateLease(propertyId: string, leaseId: string, userId: string, input: UpdateLeaseInput) {
  const lease = await getDatabase().$transaction(async (database) => {
    const current = await database.lease.findFirst({
      where: { id: leaseId, propertyId }, select: {
        id: true, status: true, currentVersion: true, leaseNumber: true, roomId: true,
        startDate: true, endDate: true, monthlyRent: true, depositAmount: true,
        versions: { orderBy: { version: "desc" }, take: 1, select: { templateId: true } },
        tenants: { where: { isPrimary: true }, select: { occupancy: { select: { tenantProfile: { select: { id: true, user: { select: { displayName: true, email: true } } } } } } } },
      },
    });
    if (!current) throw new ApiError(404, "ไม่พบสัญญา");
    // แก้ได้เฉพาะตอนยังไม่มีผล สัญญาที่ใช้งานแล้วต้องต่ออายุหรือยกเลิกแทน
    if (!["DRAFT", "PENDING_SIGNATURE"].includes(current.status)) throw new ApiError(409, "สถานะนี้ไม่สามารถแก้ไขสัญญาได้");
    if (current.currentVersion !== input.expectedVersion) throw new ApiError(409, "สัญญาถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่");
    const startDate = input.startDate ?? current.startDate;
    const endDate = input.endDate ?? current.endDate;
    if (endDate < startDate) throw new ApiError(400, "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น");
    if (input.templateId) {
      const valid = await database.documentTemplate.count({ where: { id: input.templateId, propertyId, kind: "CONTRACT" } });
      if (!valid) throw new ApiError(400, "Template สัญญาไม่ถูกต้อง");
    }
    const primary = current.tenants[0]?.occupancy.tenantProfile;
    if (!primary) throw new ApiError(409, "สัญญาไม่มีผู้เช่าหลัก");
    const version = current.currentVersion + 1;
    const monthlyRent = input.monthlyRent ?? Number(current.monthlyRent);
    const depositAmount = input.depositAmount ?? Number(current.depositAmount);
    await database.lease.update({
      where: { id: current.id },
      data: { startDate, endDate, monthlyRent, depositAmount, currentVersion: version, status: "DRAFT", signedStorageKey: null },
    });
    const templateId = input.templateId === null ? null : input.templateId ?? current.versions[0]?.templateId;
    await database.leaseVersion.create({
      data: {
        leaseId: current.id, version, templateId, createdByUserId: userId,
        snapshot: {
          leaseNumber: current.leaseNumber, tenantProfileId: primary.id,
          tenantName: primary.user.displayName, tenantEmail: primary.user.email,
          startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10),
          monthlyRent, depositAmount,
        },
      },
    });
    return database.lease.findUniqueOrThrow({ where: { id: current.id }, select: leaseSelect });
  }, { isolationLevel: "Serializable" });
  return serialize(lease);
}

export async function transitionLease(propertyId: string, leaseId: string, input: TransitionLeaseInput) {
  return getDatabase().$transaction(async (database) => {
    const lease = await database.lease.findFirst({
      where: { id: leaseId, propertyId },
      select: { id: true, roomId: true, status: true, currentVersion: true, signedStorageKey: true },
    });
    if (!lease) throw new ApiError(404, "ไม่พบสัญญา");
    if (lease.currentVersion !== input.expectedVersion) throw new ApiError(409, "สัญญาถูกแก้ไข กรุณาโหลดใหม่");
    // ใช้ตารางกฎจาก enums.ts เป็นตัวตัดสิน ไม่ได้เขียน if ไล่เองตรงนี้
    // กฎจึงอยู่ที่เดียวและมีตัวทดสอบคุมอยู่
    if (!leaseStatusTransitions[lease.status].includes(input.status)) throw new ApiError(409, "ไม่สามารถเปลี่ยนสถานะสัญญาแบบนี้ได้");
    if (input.status === "ACTIVE" && !lease.signedStorageKey) throw new ApiError(409, "กรุณาอัปโหลดสัญญาฉบับลงนามก่อน");
    if (input.status === "ACTIVE") {
      const otherActiveLease = await database.lease.count({
        where: { id: { not: lease.id }, roomId: lease.roomId, status: { in: ["ACTIVE", "EXPIRING"] } },
      });
      if (otherActiveLease > 0) throw new ApiError(409, "กรุณาปิดสัญญาเดิมเป็นหมดอายุก่อนเปิดใช้สัญญาฉบับใหม่");
    }
    return database.lease.update({
      where: { id: lease.id },
      data: {
        status: input.status,
        ...(input.status === "ACTIVE" ? { activatedAt: new Date(), endedAt: null } : {}),
        ...(["EXPIRED", "CANCELLED"].includes(input.status) ? { endedAt: new Date() } : {}),
      },
      select: { id: true, status: true, currentVersion: true, activatedAt: true, endedAt: true },
    });
  });
}

export async function attachSignedLease(propertyId: string, leaseId: string, storageKey: string) {
  await getDatabase().$transaction(async (database) => {
    const lease = await database.lease.findFirst({
      where: { id: leaseId, propertyId, status: { in: ["DRAFT", "PENDING_SIGNATURE"] } },
      select: { id: true, currentVersion: true },
    });
    if (!lease) throw new ApiError(404, "ไม่พบสัญญาที่อัปโหลดได้");
    await database.lease.update({
      where: { id: lease.id },
      data: { signedStorageKey: storageKey, status: "PENDING_SIGNATURE" },
    });
    await database.leaseVersion.update({
      where: { leaseId_version: { leaseId: lease.id, version: lease.currentVersion } },
      data: { signedStorageKey: storageKey },
    });
  });
}

export async function getSignedLeaseKey(propertyId: string, leaseId: string) {
  const lease = await getDatabase().lease.findFirst({
    where: { id: leaseId, propertyId, signedStorageKey: { not: null } },
    select: { signedStorageKey: true, leaseNumber: true },
  });
  if (!lease?.signedStorageKey) throw new ApiError(404, "ไม่พบเอกสารลงนาม");
  return { leaseNumber: lease.leaseNumber, signedStorageKey: lease.signedStorageKey };
}
