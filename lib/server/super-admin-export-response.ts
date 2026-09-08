/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “super admin export response” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { NextRequest } from "next/server";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { apiErrorResponse } from "@/lib/server/api";
import { exportSuperAdminCsv, type SuperAdminExportResource } from "@/lib/server/super-admin-exports";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “super Admin Export Response” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - resource: ค่า “resource” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function superAdminExportResponse(request: NextRequest, resource: SuperAdminExportResource) {
  try { requireRole(await requireRequestAuth(request), "SUPER_ADMIN"); const csv = await exportSuperAdminCsv(resource, request.nextUrl.searchParams.get("query")?.trim().slice(0, 160)); return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${resource}.csv"`, "Cache-Control": "no-store" } }); } catch (error) { return apiErrorResponse(error, request); }
}
