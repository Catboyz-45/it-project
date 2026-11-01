import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

// ตัวกรองตารางหอพัก ใกล้หมดอายุคือแพ็กเกจที่ใช้งานอยู่และหมดภายใน 30 วัน
export const superAdminPropertyStatusFilters = ["expiring", "inactive"] as const;
export type SuperAdminPropertyStatusFilter = typeof superAdminPropertyStatusFilters[number];
export function parseSuperAdminPropertyStatus(value: string | null | undefined): SuperAdminPropertyStatusFilter | undefined {
  return superAdminPropertyStatusFilters.find((item) => item === value);
}

// รายการหอพักในหน้าผู้ดูแลระบบ
export async function listSuperAdminProperties(
  pagination: PaginationInput,
  filters: { activeOnly?: boolean; query?: string; status?: SuperAdminPropertyStatusFilter } = {},
) {
  const now = new Date();
  const where = {
      // ตัดหอที่ระบบสร้างไว้ตอนย้ายข้อมูลออก ไม่ใช่หอจริงที่มีคนใช้งาน
      id: { not: "migration-property" },
      ...(filters.activeOnly || filters.status === "expiring" ? { isActive: true } : {}),
      ...(filters.status === "inactive" ? { isActive: false } : {}),
      // เงื่อนไขเดียวกับตัวเลข "แพ็กเกจใกล้หมดอายุ" บนแดชบอร์ด กดจากการ์ดแล้วจะเห็นหอชุดเดียวกัน
      ...(filters.status === "expiring" ? { subscription: {
        status: "ACTIVE" as const,
        expiresAt: { gt: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
      } } : {}),
      ...(filters.query ? {
        OR: [
          { name: { contains: filters.query, mode: "insensitive" as const } },
          { shortName: { contains: filters.query, mode: "insensitive" as const } },
        ],
      } : {}),
    };
  // ดึงข้อมูลกับนับจำนวนใน transaction เดียว ตัวเลขรวมกับรายการจะได้มาจากภาพเดียวกันของฐานข้อมูล
  // ตารางพวกนี้นับคุ้ม เพราะมีไม่มากและผู้ดูแลระบบอยากเห็นจำนวนรวมจริง ๆ
  const [rows, total] = await getDatabase().$transaction([
    getDatabase().property.findMany({ where,
    // เรียงใหม่สุดก่อน และใช้ id เป็นตัวตัดสินเมื่อเวลาเท่ากัน ลำดับจะได้คงที่ทุกหน้า
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, name: true, shortName: true, isActive: true,
      // ฟอร์มเปลี่ยนแพ็กเกจใช้ตั้งค่าเริ่มต้นให้ตรงกับที่หอใช้อยู่ ตารางใช้โชว์วันหมดอายุ
      subscription: { select: { planId: true, planName: true, billingInterval: true, status: true, expiresAt: true } },
    },
    }),
    getDatabase().property.count({ where }),
  ]);
  return toPaginatedResult(rows, pagination, total);
}

// รายการบัญชีเจ้าของหอ ค้นได้ทั้งชื่อ อีเมล และชื่อหอที่ดูแล
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

// รายการ audit log ค้นได้จากชื่อเหตุการณ์ อีเมลผู้ทำ และชื่อหอ
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
      id: true, action: true, result: true, createdAt: true, targetType: true, targetId: true,
      user: { select: { email: true } },
      property: { select: { name: true } },
    },
    }), getDatabase().auditLog.count({ where }),
  ]);
  return toPaginatedResult(rows, pagination, total);
}
