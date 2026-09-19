import type { UpdateOwnTenantProfileInput } from "@/lib/domain/tenant-account";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";
import { countUnreadTicketReplies } from "@/lib/server/property-operations";
import { TENANT_INVOICE_VIEW_STATUSES, type TenantRecordView } from "@/lib/tenant-record-view";

// Prisma คืน Decimal มา แปลงเป็นสตริงก่อนส่งออกไป ส่งเป็น number ตรง ๆ จะปัดเศษเพี้ยน
const decimal = (value: { toString(): string }) => value.toString();

// ข้อมูลบัญชีผู้เช่าพร้อมรายการเข้าพักทั้งหมด ใช้ตอนเปิดพื้นที่ผู้เช่า
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

export async function updateTenantAccount(
  tenantProfileId: string,
  userId: string,
  input: UpdateOwnTenantProfileInput,
) {
  const ownedProfile = await getDatabase().tenantProfile.findFirst({
    where: { id: tenantProfileId, userId },
    select: { id: true },
  });
  // ตรวจว่าโปรไฟล์นี้เป็นของผู้ใช้คนนี้จริง ไม่เชื่อ id ที่ส่งมาอย่างเดียว
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
  // เช็คว่าผู้เช่าคนนี้อยู่ห้องนั้นจริง ไม่งั้นเปลี่ยน roomId ใน URL ก็ดูห้องคนอื่นได้
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

export async function getTenantNotificationSummary(
  tenantProfileId: string,
  viewerUserId: string,
  roomId: string,
  role: "PRIMARY" | "CO_OCCUPANT",
) {
  // รวมตัวเลขแจ้งเตือนทุกอย่างในคำขอเดียว หน้าจอจะได้ไม่ต้องยิงถามหลายรอบ
  const [unpaidInvoices, waitingParcels, openTickets, unreadMessages, unreadTicketReplies] = await Promise.all([
    // ผู้พักร่วมไม่เห็นบิล จึงตอบ 0 ไปเลยโดยไม่ต้องถามฐานข้อมูล
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
    // ใช้ SQL ดิบเพราะเงื่อนไขเทียบเวลาข้อความกับเวลาที่ผู้เช่าอ่านล่าสุด ซึ่ง Prisma เขียนตรง ๆ ไม่ได้
    // ค่าส่งเป็นพารามิเตอร์ จึงไม่มีช่องให้ SQL injection
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

export async function listTenantInvoices(
  tenantProfileId: string,
  roomId: string,
  role: "PRIMARY" | "CO_OCCUPANT",
  pagination: PaginationInput,
  view: TenantRecordView = "current",
) {
  // กันตั้งแต่ต้น ไม่ต้องไปถามฐานข้อมูลแล้วค่อยกรองทีหลัง
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

export async function getTenantLease(tenantProfileId: string, roomId: string, role: "PRIMARY" | "CO_OCCUPANT") {
  // สัญญาก็เหมือนบิล ผู้พักร่วมไม่ใช่คนเซ็นจึงไม่เห็น
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
