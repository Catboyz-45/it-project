import type { NextRequest } from "next/server";
import { z } from "zod";
import type { AuthContext } from "@/lib/server/auth";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { requireSubscriptionWriteAccess } from "@/lib/server/subscription-guard";
import { setRequestActorContext } from "@/lib/server/request-context";

// ผู้เช่าหนึ่งคนอาจมีหลายห้อง คุกกี้จำไว้ว่าเปิดดูห้องไหนอยู่
export const tenantOccupancyCookieName = "tenant_occupancy";

// ด่านแรก เป็นผู้เช่าและมีโปรไฟล์ผู้เช่าแล้วหรือยัง
export async function requireTenantAuth(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  requireRole(auth, "TENANT");
  if (!auth.tenantProfileId) throw new ApiError(403, "บัญชีผู้เช่ายังไม่พร้อมใช้งาน");
  return auth as AuthContext & { tenantProfileId: string };
}

// ด่านที่สอง ต้องมีการเข้าพักที่ใช้งานอยู่จริง ใช้กับทุก API ของฝั่งผู้เช่า
// รุ่นสำหรับ Server Component ซึ่งอ่านคุกกี้จาก cookies() ไม่ใช่จาก NextRequest
// ใช้เงื่อนไขค้นหาชุดเดียวกับ requireActiveTenant กติกาความปลอดภัยจึงอยู่ที่เดียว
// ไม่เชื่อคุกกี้อย่างเดียว ยังบังคับว่าต้องเป็นของผู้เช่าคนนี้ สถานะใช้งานอยู่ และหอยังเปิด
export async function findActiveOccupancyForPage(tenantProfileId: string, selectedOccupancyId?: string) {
  return getDatabase().roomOccupancy.findFirst({
    where: {
      ...(selectedOccupancyId ? { id: selectedOccupancyId } : {}),
      tenantProfileId,
      status: "ACTIVE",
      property: { isActive: true },
    },
    // ไม่มีคุกกี้หรือคุกกี้ใช้ไม่ได้ ก็ตกไปที่ห้องที่เข้าล่าสุด
    orderBy: { startedAt: "desc" },
    select: { id: true, propertyId: true, roomId: true, role: true },
  });
}

export async function requireActiveTenant(request: NextRequest) {
  const auth = await requireTenantAuth(request);
  const selectedOccupancyId = request.cookies.get(tenantOccupancyCookieName)?.value;
  const occupancy = await getDatabase().roomOccupancy.findFirst({
    where: {
      // ไม่เชื่อคุกกี้อย่างเดียว ยังบังคับว่าต้องเป็นของผู้เช่าคนนี้ สถานะใช้งานอยู่ และหอยังเปิด
      // แก้คุกกี้เองก็เข้าห้องของคนอื่นไม่ได้
      ...(selectedOccupancyId ? { id: selectedOccupancyId } : {}),
      tenantProfileId: auth.tenantProfileId,
      status: "ACTIVE",
      property: { isActive: true },
    },
    // ไม่มีคุกกี้หรือคุกกี้ใช้ไม่ได้ ก็ตกไปที่ห้องที่เข้าล่าสุด
    orderBy: { startedAt: "desc" },
    select: {
      id: true, propertyId: true, roomId: true, role: true,
    },
  });
  // ยังไม่มีห้องที่ใช้งานอยู่ มักเป็นเพราะเพิ่งสมัครแล้วรออนุมัติ
  if (!occupancy) throw new ApiError(403, "กรุณารอเจ้าของหออนุมัติการเข้าพัก");
  setRequestActorContext(request, { userId: auth.userId, propertyId: occupancy.propertyId });
  // แพ็กเกจของหอหมดอายุ ผู้เช่าก็ทำรายการไม่ได้ แต่ยังอ่านข้อมูลเดิมได้
  if (request.method !== "GET" && request.method !== "HEAD") {
    await requireSubscriptionWriteAccess(occupancy.propertyId);
  }
  return { auth, occupancy };
}

// รวม PENDING ด้วย ใช้กับหน้าที่ต้องแสดงสถานะรออนุมัติให้ผู้เช่าเห็น
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

// id รูปแบบผิดตอบว่าไม่พบ ไม่ใช่บอกว่ารูปแบบผิด ค่านี้มาจาก URL ที่ผู้ใช้พิมพ์เองได้
export function parseTenantRecordId(value: string) {
  const parsed = z.cuid().safeParse(value);
  if (!parsed.success) throw new ApiError(404, "ไม่พบข้อมูล");
  return parsed.data;
}

// ข้อมูลการเงินเห็นได้เฉพาะผู้เช่าหลักที่ยังพักอยู่จริง
// ผู้พักร่วมอยู่ห้องเดียวกันแต่ไม่ใช่คนเซ็นสัญญา จึงไม่เห็นบิล
export function canAccessTenantFinancialRecords(
  role: "PRIMARY" | "CO_OCCUPANT",
  status: "PENDING" | "ACTIVE",
) {
  return role === "PRIMARY" && status === "ACTIVE";
}

// ดึงบิลพร้อมตรวจความเป็นเจ้าของในคำสั่งเดียว ไม่ใช่ดึงมาแล้วค่อยเช็คในโค้ด
// ทำแบบนี้จึงไม่มีทางลืมเช็ค และไม่มีจังหวะที่ข้อมูลหลุดออกมาก่อน
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
