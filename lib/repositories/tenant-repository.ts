/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นชั้นเข้าถึงข้อมูลสำหรับ “tenant repository” เพื่อไม่ให้หน้าจอหรือ route ติดต่อฐานข้อมูลโดยตรง
 * การทำงาน: รวมคำสั่งอ่านและเขียนข้อมูลไว้จุดเดียว เลือกเฉพาะฟิลด์ที่จำเป็น และเปิดทางให้ตรวจสิทธิ์/transaction ใน service ชั้นบน
 */

import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

export const tenantRepository = {
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - query: ค่า “query” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async list(propertyId: string, pagination: PaginationInput, query?: string) {
    const normalizedQuery = query?.trim();
    const rows = await getDatabase().roomOccupancy.findMany({
      where: {
        propertyId,
        status: { in: ["PENDING", "ACTIVE"] },
        ...(normalizedQuery ? {
          OR: [
            { room: { number: { contains: normalizedQuery, mode: "insensitive" } } },
            { tenantProfile: { phone: { contains: normalizedQuery } } },
            { tenantProfile: { user: { displayName: { contains: normalizedQuery, mode: "insensitive" } } } },
            { tenantProfile: { user: { email: { contains: normalizedQuery, mode: "insensitive" } } } },
          ],
        } : {}),
      },
      orderBy: [{ room: { number: "asc" } }, { role: "asc" }, { id: "asc" }],
      ...paginationQuery(pagination),
      select: {
        id: true, role: true, status: true, startedAt: true, createdAt: true,
        room: {
          select: {
            id: true, number: true, monthlyRent: true, depositAmount: true,
            occupancies: {
              where: { status: "ACTIVE" },
              orderBy: [{ role: "asc" }, { createdAt: "asc" }],
              select: {
                id: true, role: true,
                tenantProfile: { select: { id: true, user: { select: { displayName: true } } } },
              },
            },
          },
        },
        tenantProfile: {
          select: {
            id: true, phone: true, address: true, emergencyName: true, emergencyPhone: true,
            vehicle: true,
            user: { select: { id: true, displayName: true, email: true, isActive: true } },
          },
        },
        leases: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            lease: {
              select: {
                leaseNumber: true, status: true, startDate: true, endDate: true,
                monthlyRent: true, depositAmount: true,
              },
            },
          },
        },
      },
    });
    return toPaginatedResult(rows, pagination);
  },
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “find” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
find(propertyId: string, tenantProfileId: string) {
    return getDatabase().tenantProfile.findFirst({
      where: { id: tenantProfileId, occupancies: { some: { propertyId } } },
      select: {
        id: true, phone: true, address: true, emergencyName: true, emergencyPhone: true,
        vehicle: true,
        user: { select: { id: true, displayName: true, email: true, isActive: true } },
        occupancies: {
          where: { propertyId }, orderBy: { createdAt: "desc" },
          select: { id: true, role: true, status: true, startedAt: true, endedAt: true, room: { select: { id: true, number: true } } },
        },
      },
    });
  },
};
