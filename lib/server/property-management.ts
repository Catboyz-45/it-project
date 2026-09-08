/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “property management” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { z } from "zod";
import type {
  endOccupancySchema,
  superAdminPropertyUpdateSchema,
  updatePropertySchema,
  updatePropertySettingsSchema,
  updateTenantProfileSchema,
} from "@/lib/domain/property-management";
import { propertyRepository } from "@/lib/repositories/property-repository";
import { tenantRepository } from "@/lib/repositories/tenant-repository";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Property Workspace” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getPropertyWorkspace(propertyId: string) {
  const property = await propertyRepository.findWorkspace(propertyId);
  if (!property) throw new ApiError(404, "ไม่พบหอพัก");
  return property;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Property Identity” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function updatePropertyIdentity(propertyId: string, input: z.infer<typeof updatePropertySchema>) {
  return propertyRepository.updateIdentity(propertyId, input);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “save Property Settings” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function savePropertySettings(propertyId: string, input: z.infer<typeof updatePropertySettingsSchema>) {
  return propertyRepository.upsertSettings(propertyId, { propertyId, ...input });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “super Admin Update Property” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function superAdminUpdateProperty(
  propertyId: string,
  input: z.infer<typeof superAdminPropertyUpdateSchema>,
) {
  return getDatabase().$transaction(async (database) => {
    const property = await database.property.findUnique({
      where: { id: propertyId },
      select: { id: true, subscription: { select: { maxProperties: true } } },
    });
    if (!property) throw new ApiError(404, "ไม่พบหอพัก");
    const memberUserIds = input.memberUserIds ? [...new Set(input.memberUserIds)] : undefined;
    if (memberUserIds) {
      const members = await database.user.findMany({
        where: {
          id: { in: memberUserIds },
          role: "PROPERTY_ADMIN",
          isActive: true,
          approvalStatus: "APPROVED",
        },
        select: { id: true },
      });
      if (members.length !== memberUserIds.length) {
        throw new ApiError(400, "มีบัญชีผู้ดูแลหอที่ไม่พร้อมใช้งาน");
      }
      if (!property.subscription && memberUserIds.length > 0) {
        throw new ApiError(409, "กรุณากำหนดแพ็กเกจก่อนมอบหมายผู้ดูแลหอ");
      }
      for (const userId of memberUserIds) {
        const managedCount = await database.propertyMembership.count({
          where: { userId, propertyId: { not: propertyId }, property: { isActive: true } },
        });
        if (managedCount >= (property.subscription?.maxProperties ?? 0)) {
          throw new ApiError(409, "จำนวนหอที่ผู้ดูแลรับผิดชอบถึงขีดจำกัดแพ็กเกจแล้ว");
        }
      }
    }
    await database.property.update({
      where: { id: propertyId },
      data: { isActive: input.isActive },
    });
    if (memberUserIds) {
      await database.propertyMembership.deleteMany({
        where: { propertyId, userId: { notIn: memberUserIds } },
      });
      await database.propertyMembership.createMany({
        data: memberUserIds.map((userId) => ({ userId, propertyId })),
        skipDuplicates: true,
      });
    }
    return database.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        isActive: true,
        subscription: true,
        memberships: {
          orderBy: { createdAt: "asc" },
          select: {
            user: {
              select: { id: true, email: true, displayName: true, approvalStatus: true, isActive: true },
            },
          },
        },
      },
    });
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Property Tenants” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - query: ค่า “query” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listPropertyTenants(
  propertyId: string,
  pagination: import("@/lib/server/pagination").PaginationInput,
  query?: string,
) {
  const result = await tenantRepository.list(propertyId, pagination, query);
  return {
    ...result,
    data: result.data.map((item) => {
      const lease = item.leases[0]?.lease;
      const vehicle = item.tenantProfile.vehicle;
      const vehicleType = vehicle?.type === "MOTORCYCLE" ? "รถจักรยานยนต์"
        : vehicle?.type === "CAR" ? "รถยนต์"
          : vehicle?.type === "BICYCLE" ? "รถจักรยาน"
            : vehicle?.type === "OTHER" ? "อื่น ๆ"
              : "ไม่มีรถ";
      return {
        id: item.tenantProfile.id,
        role: item.role,
        name: item.tenantProfile.user.displayName,
        phone: item.tenantProfile.phone,
        email: item.tenantProfile.user.email,
        roomId: item.room.number,
        address: item.tenantProfile.address ?? "",
        guardianName: item.tenantProfile.emergencyName ?? "",
        guardianPhone: item.tenantProfile.emergencyPhone ?? "",
        occupantCount: item.room.occupancies.length,
        coOccupants: item.room.occupancies
          .filter((occupancy) => occupancy.tenantProfile.id !== item.tenantProfile.id)
          .map((occupancy) => ({
            id: occupancy.tenantProfile.id,
            name: occupancy.tenantProfile.user.displayName,
            role: occupancy.role,
          })),
        vehicleType,
        vehiclePlate: vehicle?.licensePlate ?? "",
        vehicleProvince: vehicle?.province ?? "",
        vehicleBrand: vehicle?.brandModel ?? "",
        vehicleColor: vehicle?.color ?? "",
        vehicleDetail: vehicle?.detail ?? "",
        startDate: (lease?.startDate ?? item.startedAt ?? item.createdAt).toISOString().slice(0, 10),
        contractEnd: lease?.endDate.toISOString().slice(0, 10),
        deposit: Number(lease?.depositAmount ?? item.room.depositAmount),
        monthlyRent: Number(lease?.monthlyRent ?? item.room.monthlyRent),
        leaseNumber: lease?.leaseNumber,
        leaseStatus: lease?.status,
      };
    }),
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Property Tenant” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getPropertyTenant(propertyId: string, tenantProfileId: string) {
  const tenant = await tenantRepository.find(propertyId, tenantProfileId);
  if (!tenant) throw new ApiError(404, "ไม่พบผู้เช่า");
  return tenant;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Property Tenant” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function updatePropertyTenant(
  propertyId: string,
  tenantProfileId: string,
  input: z.infer<typeof updateTenantProfileSchema>,
) {
  const tenant = await tenantRepository.find(propertyId, tenantProfileId);
  if (!tenant) throw new ApiError(404, "ไม่พบผู้เช่า");
  const { displayName, vehicle, ...profile } = input;
  return getDatabase().$transaction(async (database) => {
    if (displayName) {
      await database.user.update({ where: { id: tenant.user.id }, data: { displayName } });
    }
    await database.tenantProfile.update({
      where: { id: tenantProfileId },
      data: profile,
    });
    if (vehicle === null) {
      await database.tenantVehicle.deleteMany({ where: { tenantProfileId } });
    } else if (vehicle) {
      await database.tenantVehicle.upsert({
        where: { tenantProfileId },
        create: { tenantProfileId, ...vehicle },
        update: vehicle,
      });
    }
    return database.tenantProfile.findUniqueOrThrow({
      where: { id: tenantProfileId },
      select: {
        id: true, phone: true, address: true, emergencyName: true, emergencyPhone: true,
        vehicle: true,
        user: { select: { id: true, displayName: true, email: true, isActive: true } },
      },
    });
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “end Property Occupancy” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - occupancyId: รหัสภายในของ occupancy
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function endPropertyOccupancy(
  propertyId: string,
  occupancyId: string,
  input: z.infer<typeof endOccupancySchema>,
) {
  return getDatabase().$transaction(async (database) => {
    const occupancy = await database.roomOccupancy.findFirst({
      where: { id: occupancyId, propertyId, status: "ACTIVE" },
      select: { id: true, roomId: true },
    });
    if (!occupancy) throw new ApiError(404, "ไม่พบการเข้าพักที่ใช้งานอยู่");
    const activeLease = await database.lease.count({
      where: { roomId: occupancy.roomId, status: { in: ["ACTIVE", "EXPIRING", "PENDING_SIGNATURE"] } },
    });
    if (activeLease > 0) throw new ApiError(409, "ต้องสิ้นสุดสัญญาที่ใช้งานอยู่ก่อน");
    const updated = await database.roomOccupancy.update({
      where: { id: occupancy.id },
      data: { status: "ENDED", endedAt: new Date(), endReason: input.reason },
      select: { id: true, status: true, endedAt: true },
    });
    const remaining = await database.roomOccupancy.count({
      where: { roomId: occupancy.roomId, status: "ACTIVE" },
    });
    if (remaining === 0) {
      await database.room.update({ where: { id: occupancy.roomId }, data: { status: "AVAILABLE" } });
    }
    return updated;
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “revoke Invitation” ตามกฎของระบบ
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - invitationId: รหัสภายในของ invitation
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function revokeInvitation(propertyId: string, invitationId: string) {
  const result = await getDatabase().tenantInvitation.updateMany({
    where: { id: invitationId, propertyId, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  if (result.count !== 1) throw new ApiError(404, "ไม่พบรหัสเชิญที่ยกเลิกได้");
}
