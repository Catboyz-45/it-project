/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “tenant portal” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { UpdateOwnTenantProfileInput } from "@/lib/domain/tenant-account";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";
import { countUnreadTicketReplies } from "@/lib/server/property-operations";
import { TENANT_INVOICE_VIEW_STATUSES, type TenantRecordView } from "@/lib/tenant-record-view";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “decimal” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const decimal = (value: { toString(): string }) => value.toString();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Tenant Account” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getTenantAccount(tenantProfileId: string) {
  const profile = await getDatabase().tenantProfile.findUnique({
    where: { id: tenantProfileId },
    select: {
      id: true, phone: true, address: true, emergencyName: true, emergencyPhone: true,
      user: { select: { displayName: true, email: true } },
      occupancies: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, role: true, status: true, startedAt: true, endedAt: true,
          room: { select: { number: true } },
          property: { select: { id: true, name: true, shortName: true, isActive: true } },
        },
      },
    },
  });
  if (!profile) throw new ApiError(404, "ไม่พบข้อมูลบัญชี");
  return profile;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Tenant Account” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function updateTenantAccount(
  tenantProfileId: string,
  userId: string,
  input: UpdateOwnTenantProfileInput,
) {
  const ownedProfile = await getDatabase().tenantProfile.findFirst({
    where: { id: tenantProfileId, userId },
    select: { id: true },
  });
  if (!ownedProfile) throw new ApiError(404, "ไม่พบข้อมูลบัญชี");

  await getDatabase().$transaction([
    getDatabase().user.update({
      where: { id: userId },
      data: { displayName: input.displayName },
    }),
    getDatabase().tenantProfile.update({
      where: { id: tenantProfileId },
      data: {
        phone: input.phone,
        address: input.address,
        emergencyName: input.emergencyName,
        emergencyPhone: input.emergencyPhone,
      },
    }),
  ]);
  return getTenantAccount(tenantProfileId);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Tenant Room” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - roomId: รหัสภายในของห้องพัก
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getTenantRoom(tenantProfileId: string, roomId: string) {
  const occupancy = await getDatabase().roomOccupancy.findFirst({
    where: { tenantProfileId, roomId, status: "ACTIVE" },
    select: {
      role: true, startedAt: true,
      room: {
        select: {
          id: true, number: true, roomType: true, monthlyRent: true,
          capacity: true, status: true,
          furnitureItems: {
            orderBy: { furnitureOption: { name: "asc" } },
            select: { quantity: true, furnitureOption: { select: { id: true, name: true } } },
          },
          building: { select: { name: true, code: true } },
          floor: { select: { number: true, label: true } },
          property: {
            select: {
              id: true, name: true, shortName: true,
              settings: {
                select: {
                  address: true, contactPhone: true, contactEmail: true,
                  houseRules: true, emergencyContact: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!occupancy) throw new ApiError(404, "ไม่พบข้อมูล");
  return {
    ...occupancy,
    room: {
      ...occupancy.room,
      furniture: occupancy.room.furnitureItems.map((item) => item.furnitureOption.name),
      furnitureItems: undefined,
      monthlyRent: decimal(occupancy.room.monthlyRent),
    },
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Tenant Notification Summary” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - viewerUserId: รหัสภายในของ viewer User
 * - roomId: รหัสภายในของห้องพัก
 * - role: ค่า “role” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getTenantNotificationSummary(
  tenantProfileId: string,
  viewerUserId: string,
  roomId: string,
  role: "PRIMARY" | "CO_OCCUPANT",
) {
  const [unpaidInvoices, waitingParcels, openTickets, unreadMessages, unreadTicketReplies] = await Promise.all([
    role === "PRIMARY"
      ? getDatabase().invoice.count({
          where: {
            roomId,
            status: { in: ["PENDING", "OVERDUE"] },
            room: {
              occupancies: {
                some: { tenantProfileId, role: "PRIMARY", status: "ACTIVE" },
              },
            },
          },
        })
      : Promise.resolve(0),
    getDatabase().parcel.count({
      where: {
        roomId,
        status: "WAITING",
        room: { occupancies: { some: { tenantProfileId, status: "ACTIVE" } } },
      },
    }),
    getDatabase().serviceTicket.count({
      where: {
        tenantProfileId,
        roomId,
        status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] },
      },
    }),
    getDatabase().$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "ChatMessage" message
      INNER JOIN "ChatConversation" conversation ON conversation."id" = message."conversationId"
      WHERE conversation."tenantProfileId" = ${tenantProfileId}
        AND conversation."type" = 'TENANT_PROPERTY'
        AND message."senderRole" = 'ADMIN'
        AND (conversation."lastTenantReadAt" IS NULL OR message."createdAt" > conversation."lastTenantReadAt")
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    countUnreadTicketReplies({
      viewerUserId,
      tenantProfileId,
      incomingRoles: ["PROPERTY_ADMIN", "SUPER_ADMIN"],
    }),
  ]);

  return { unpaidInvoices, waitingParcels, openTickets, unreadMessages, unreadTicketReplies };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Tenant Invoices” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - roomId: รหัสภายในของห้องพัก
 * - role: ค่า “role” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - view: ค่า “view” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listTenantInvoices(
  tenantProfileId: string,
  roomId: string,
  role: "PRIMARY" | "CO_OCCUPANT",
  pagination: PaginationInput,
  view: TenantRecordView = "current",
) {
  if (role !== "PRIMARY") throw new ApiError(403, "เฉพาะผู้เช่าหลักเท่านั้นที่ดูบิลได้");
  const where = {
    roomId,
    status: { in: [...TENANT_INVOICE_VIEW_STATUSES[view]] },
    room: { occupancies: { some: { tenantProfileId, role: "PRIMARY" as const, status: "ACTIVE" as const } } },
  };
  const [invoices, total] = await getDatabase().$transaction([
    getDatabase().invoice.findMany({
      where,
      orderBy: [{ billingMonth: "desc" }, { id: "desc" }],
      ...paginationQuery(pagination),
      select: {
        id: true, invoiceNumber: true, billingMonth: true, status: true,
        dueDate: true, total: true, paidAt: true, cancelledAt: true,
      },
    }),
    getDatabase().invoice.count({ where }),
  ]);
  return toPaginatedResult(
    invoices.map((invoice) => ({ ...invoice, total: decimal(invoice.total) })),
    pagination,
    total,
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Tenant Lease” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - roomId: รหัสภายในของห้องพัก
 * - role: ค่า “role” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getTenantLease(tenantProfileId: string, roomId: string, role: "PRIMARY" | "CO_OCCUPANT") {
  if (role !== "PRIMARY") throw new ApiError(403, "เฉพาะผู้เช่าหลักเท่านั้นที่ดูสัญญาได้");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tenantWhere = { some: { isPrimary: true, occupancy: { tenantProfileId, status: "ACTIVE" as const } } };
  const select = {
    id: true, leaseNumber: true, status: true, startDate: true, endDate: true,
    monthlyRent: true, depositAmount: true, currentVersion: true, activatedAt: true,
    room: { select: { number: true } },
  } as const;
  const [currentLease, upcomingLease] = await getDatabase().$transaction([
    getDatabase().lease.findFirst({
      where: {
        roomId,
        status: { in: ["ACTIVE", "EXPIRING"] },
        startDate: { lte: today },
        endDate: { gte: today },
        tenants: tenantWhere,
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      select,
    }),
    getDatabase().lease.findFirst({
      where: {
        roomId,
        status: "PENDING_SIGNATURE",
        startDate: { gt: today },
        tenants: tenantWhere,
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      select,
    }),
  ]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: แปลงข้อมูลในขั้นตอน “serialize Lease” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
   * รับค่า:
   * - lease: ค่า “lease” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const serializeLease = (lease: NonNullable<typeof currentLease>) => ({
    ...lease,
    monthlyRent: decimal(lease.monthlyRent),
    depositAmount: decimal(lease.depositAmount),
  });
  return {
    current: currentLease ? serializeLease(currentLease) : null,
    upcoming: upcomingLease ? serializeLease(upcomingLease) : null,
  };
}
