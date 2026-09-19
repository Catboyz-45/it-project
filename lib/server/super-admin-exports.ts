import { createCsv } from "@/lib/csv";
import { getDatabase } from "@/lib/server/db";

export type SuperAdminExportResource = "plans" | "properties" | "users" | "audit-logs";

// สร้าง CSV ของแต่ละตารางในหน้าผู้ดูแลระบบ
export async function exportSuperAdminCsv(resource: SuperAdminExportResource, query = "") {
  // ไม่มีคำค้นก็เป็น undefined แล้วเงื่อนไข where จะถูกข้ามไปทั้งก้อน
  // insensitive ให้ค้นโดยไม่สนตัวพิมพ์ใหญ่เล็ก
  const contains = query ? { contains: query, mode: "insensitive" as const } : undefined;
  if (resource === "properties") {
    // ตัดหอที่ระบบสร้างไว้ตอนย้ายข้อมูลออก ไม่ใช่หอจริงที่มีคนใช้งาน
    const rows = await getDatabase().property.findMany({ where: { id: { not: "migration-property" }, ...(contains ? { OR: [{ name: contains }, { shortName: contains }] } : {}) }, orderBy: { name: "asc" }, select: { name: true, shortName: true, isActive: true, createdAt: true } });
    return createCsv([["ชื่อหอ", "ชื่อย่อ", "สถานะ", "สร้างเมื่อ"], ...rows.map((r) => [r.name, r.shortName, r.isActive ? "ใช้งาน" : "ปิดใช้งาน", r.createdAt])]);
  }
  if (resource === "plans") {
    const rows = await getDatabase().saasPlan.findMany({ where: contains ? { OR: [{ name: contains }, { code: contains }] } : {}, orderBy: { sortOrder: "asc" }, select: { code: true, name: true, monthlyPrice: true, yearlyPrice: true, maxProperties: true, maxRooms: true, isActive: true } });
    return createCsv([["รหัส", "ชื่อ", "รายเดือน", "รายปี", "จำนวนหอสูงสุด", "จำนวนห้องสูงสุด", "สถานะ"], ...rows.map((r) => [r.code, r.name, r.monthlyPrice.toString(), r.yearlyPrice?.toString(), r.maxProperties, r.maxRooms, r.isActive ? "เปิดขาย" : "ปิดขาย"])]);
  }
  if (resource === "users") {
    const rows = await getDatabase().user.findMany({ where: { role: "PROPERTY_ADMIN", ...(contains ? { OR: [{ displayName: contains }, { email: contains }] } : {}) }, orderBy: { createdAt: "desc" }, select: { displayName: true, email: true, approvalStatus: true, isActive: true, memberships: { select: { property: { select: { name: true } } } } } });
    return createCsv([["ชื่อ", "อีเมล", "หอที่ดูแล", "การอนุมัติ", "สถานะ"], ...rows.map((r) => [r.displayName, r.email, r.memberships.map((m) => m.property.name).join("; "), r.approvalStatus, r.isActive ? "ใช้งาน" : "ระงับ"])]);
  }
  // audit log จำกัด 10000 แถว เพราะสะสมเร็วมาก ดึงหมดจะกินหน่วยความจำจนเซิร์ฟเวอร์ล้ม
  const rows = await getDatabase().auditLog.findMany({ where: contains ? { OR: [{ action: contains }, { user: { email: contains } }, { property: { name: contains } }] } : {}, orderBy: { createdAt: "desc" }, take: 10_000, select: { createdAt: true, action: true, result: true, requestId: true, user: { select: { email: true } }, property: { select: { name: true } } } });
  return createCsv([["เวลา", "ผู้ใช้", "หอ", "เหตุการณ์", "ผลลัพธ์", "Request ID"], ...rows.map((r) => [r.createdAt, r.user?.email, r.property?.name, r.action, r.result, r.requestId])]);
}
