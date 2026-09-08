/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “leases” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { leaseStatusTransitions } from "@/lib/domain/enums";
import type { CreateLeaseInput, RenewLeaseInput, TransitionLeaseInput, UpdateLeaseInput } from "@/lib/domain/leases";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “serialize” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - lease: ค่า “lease” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const serialize = <T extends { monthlyRent: { toString(): string }; depositAmount: { toString(): string } }>(lease: T) => ({
  ...lease,
  monthlyRent: lease.monthlyRent.toString(),
  depositAmount: lease.depositAmount.toString(),
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Leases” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - query: ค่า “query” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Lease” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - leaseId: รหัสภายในของ lease
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getLease(propertyId: string, leaseId: string) {
  const lease = await getDatabase().lease.findFirst({ where: { id: leaseId, propertyId }, select: leaseSelect });
  if (!lease) throw new ApiError(404, "ไม่พบสัญญา");
  return serialize(lease);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Lease” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
    if (!occupancy) throw new ApiError(409, "ห้องต้องมีผู้เช่าหลักที่อนุมัติแล้ว");
    const live = await database.lease.count({
      where: { roomId: input.roomId, status: { in: ["PENDING_SIGNATURE", "ACTIVE", "EXPIRING"] } },
    });
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “renew Lease” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - sourceLeaseId: รหัสภายในของ source Lease
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
    if (input.startDate <= source.endDate) throw new ApiError(409, "สัญญาใหม่ต้องเริ่มหลังวันสิ้นสุดของสัญญาเดิม");
    const primary = source.tenants[0]?.occupancy;
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Lease” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - leaseId: รหัสภายในของ lease
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “transition Lease” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - leaseId: รหัสภายในของ lease
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function transitionLease(propertyId: string, leaseId: string, input: TransitionLeaseInput) {
  return getDatabase().$transaction(async (database) => {
    const lease = await database.lease.findFirst({
      where: { id: leaseId, propertyId },
      select: { id: true, roomId: true, status: true, currentVersion: true, signedStorageKey: true },
    });
    if (!lease) throw new ApiError(404, "ไม่พบสัญญา");
    if (lease.currentVersion !== input.expectedVersion) throw new ApiError(409, "สัญญาถูกแก้ไข กรุณาโหลดใหม่");
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “attach Signed Lease” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - leaseId: รหัสภายในของ lease
 * - storageKey: ค่า “storage Key” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Signed Lease Key” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - leaseId: รหัสภายในของ lease
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getSignedLeaseKey(propertyId: string, leaseId: string) {
  const lease = await getDatabase().lease.findFirst({
    where: { id: leaseId, propertyId, signedStorageKey: { not: null } },
    select: { signedStorageKey: true, leaseNumber: true },
  });
  if (!lease?.signedStorageKey) throw new ApiError(404, "ไม่พบเอกสารลงนาม");
  return { leaseNumber: lease.leaseNumber, signedStorageKey: lease.signedStorageKey };
}
