/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “super admin exports” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { createCsv } from "@/lib/csv";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Super Admin Export Resource” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type SuperAdminExportResource = "plans" | "properties" | "users" | "audit-logs";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “export Super Admin Csv” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - resource: ค่า “resource” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - query: ค่า “query” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function exportSuperAdminCsv(resource: SuperAdminExportResource, query = "") {
  const contains = query ? { contains: query, mode: "insensitive" as const } : undefined;
  if (resource === "properties") {
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
  const rows = await getDatabase().auditLog.findMany({ where: contains ? { OR: [{ action: contains }, { user: { email: contains } }, { property: { name: contains } }] } : {}, orderBy: { createdAt: "desc" }, take: 10_000, select: { createdAt: true, action: true, result: true, requestId: true, user: { select: { email: true } }, property: { select: { name: true } } } });
  return createCsv([["เวลา", "ผู้ใช้", "หอ", "เหตุการณ์", "ผลลัพธ์", "Request ID"], ...rows.map((r) => [r.createdAt, r.user?.email, r.property?.name, r.action, r.result, r.requestId])]);
}
