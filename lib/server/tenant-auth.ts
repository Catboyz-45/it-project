/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “tenant auth” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import type { AuthContext } from "@/lib/server/auth";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { requireSubscriptionWriteAccess } from "@/lib/server/subscription-guard";
import { setRequestActorContext } from "@/lib/server/request-context";

export const tenantOccupancyCookieName = "tenant_occupancy";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Tenant Auth” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireTenantAuth(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  requireRole(auth, "TENANT");
  if (!auth.tenantProfileId) throw new ApiError(403, "บัญชีผู้เช่ายังไม่พร้อมใช้งาน");
  return auth as AuthContext & { tenantProfileId: string };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Active Tenant” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireActiveTenant(request: NextRequest) {
  const auth = await requireTenantAuth(request);
  const selectedOccupancyId = request.cookies.get(tenantOccupancyCookieName)?.value;
  const occupancy = await getDatabase().roomOccupancy.findFirst({
    where: {
      ...(selectedOccupancyId ? { id: selectedOccupancyId } : {}),
      tenantProfileId: auth.tenantProfileId,
      status: "ACTIVE",
      property: { isActive: true },
    },
    orderBy: { startedAt: "desc" },
    select: {
      id: true, propertyId: true, roomId: true, role: true,
    },
  });
  if (!occupancy) throw new ApiError(403, "กรุณารอเจ้าของหออนุมัติการเข้าพัก");
  setRequestActorContext(request, { userId: auth.userId, propertyId: occupancy.propertyId });
  if (request.method !== "GET" && request.method !== "HEAD") {
    await requireSubscriptionWriteAccess(occupancy.propertyId);
  }
  return { auth, occupancy };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Tenant Occupancy” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - occupancyId: รหัสภายในของ occupancy
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireTenantOccupancy(
  tenantProfileId: string,
  occupancyId: string,
) {
  const occupancy = await getDatabase().roomOccupancy.findFirst({
    where: {
      id: occupancyId,
      tenantProfileId,
      status: { in: ["PENDING", "ACTIVE"] },
      property: { isActive: true },
    },
    select: { id: true, status: true, propertyId: true, roomId: true, role: true },
  });
  if (!occupancy) throw new ApiError(404, "ไม่พบการเข้าพัก");
  return occupancy;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Tenant Record Id” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function parseTenantRecordId(value: string) {
  const parsed = z.string().cuid().safeParse(value);
  if (!parsed.success) throw new ApiError(404, "ไม่พบข้อมูล");
  return parsed.data;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “can Access Tenant Financial Records” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - role: ค่า “role” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function canAccessTenantFinancialRecords(
  role: "PRIMARY" | "CO_OCCUPANT",
  status: "PENDING" | "ACTIVE",
) {
  return role === "PRIMARY" && status === "ACTIVE";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “require Owned Invoice” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - invoiceId: รหัสภายในของบิล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function requireOwnedInvoice(
  tenantProfileId: string,
  invoiceId: string,
) {
  const invoice = await getDatabase().invoice.findFirst({
    where: {
      id: invoiceId,
      room: {
        occupancies: {
          some: { tenantProfileId, role: "PRIMARY", status: "ACTIVE" },
        },
      },
    },
    select: {
      id: true, invoiceNumber: true, billingMonth: true, status: true,
      issuedAt: true, dueDate: true, subtotal: true, lateFee: true, total: true, paidAt: true,
      room: { select: { number: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, type: true, description: true, quantity: true, unitPrice: true, amount: true },
      },
    },
  });
  if (!invoice) throw new ApiError(404, "ไม่พบข้อมูล");
  return invoice;
}
