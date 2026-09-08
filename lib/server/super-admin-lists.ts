/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “super admin lists” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Super Admin Properties” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - filters: ค่า “filters” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listSuperAdminProperties(
  pagination: PaginationInput,
  filters: { activeOnly?: boolean; query?: string } = {},
) {
  const where = {
      id: { not: "migration-property" },
      ...(filters.activeOnly ? { isActive: true } : {}),
      ...(filters.query ? {
        OR: [
          { name: { contains: filters.query, mode: "insensitive" as const } },
          { shortName: { contains: filters.query, mode: "insensitive" as const } },
        ],
      } : {}),
    };
  const [rows, total] = await getDatabase().$transaction([
    getDatabase().property.findMany({ where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: { id: true, name: true, shortName: true, isActive: true },
    }),
    getDatabase().property.count({ where }),
  ]);
  return toPaginatedResult(rows, pagination, total);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Super Admin Users” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - filters: ค่า “filters” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listSuperAdminUsers(pagination: PaginationInput, filters: { query?: string; approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" } = {}) {
  const where = { role: "PROPERTY_ADMIN" as const,
    ...(filters.approvalStatus ? { approvalStatus: filters.approvalStatus } : {}),
    ...(filters.query ? { OR: [
      { displayName: { contains: filters.query, mode: "insensitive" as const } },
      { email: { contains: filters.query, mode: "insensitive" as const } },
      { memberships: { some: { property: { name: { contains: filters.query, mode: "insensitive" as const } } } } },
    ] } : {}),
  };
  const [rows, total] = await getDatabase().$transaction([
    getDatabase().user.findMany({ where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, email: true, displayName: true, isActive: true,
      approvalStatus: true, approvalRejectionReason: true,
      memberships: { select: { property: { select: { id: true, name: true } } } },
    },
    }), getDatabase().user.count({ where }),
  ]);
  return toPaginatedResult(rows, pagination, total);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Super Admin Audit Logs” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - filters: ค่า “filters” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listSuperAdminAuditLogs(pagination: PaginationInput, filters: { query?: string; result?: "SUCCESS" | "FAILURE" } = {}) {
  const where = { ...(filters.result ? { result: filters.result } : {}), ...(filters.query ? { OR: [
    { action: { contains: filters.query, mode: "insensitive" as const } },
    { user: { email: { contains: filters.query, mode: "insensitive" as const } } },
    { property: { name: { contains: filters.query, mode: "insensitive" as const } } },
  ] } : {}) };
  const [rows, total] = await getDatabase().$transaction([
    getDatabase().auditLog.findMany({ where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, action: true, result: true, createdAt: true,
      user: { select: { email: true } },
      property: { select: { name: true } },
    },
    }), getDatabase().auditLog.count({ where }),
  ]);
  return toPaginatedResult(rows, pagination, total);
}
