import type {
  CreateAnnouncementInput,
  CreateParcelInput,
  CreateTicketReplyInput,
  CreateTicketInput,
  UpdateAnnouncementInput,
  UpdateParcelInput,
  UpdateTicketInput,
} from "@/lib/domain/property-operations";
import { ticketTransitions } from "@/lib/domain/property-operations";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";
import {
  TENANT_PARCEL_VIEW_STATUSES,
  TENANT_TICKET_VIEW_STATUSES,
  type TenantRecordView,
} from "@/lib/tenant-record-view";

export async function listAnnouncements(propertyId: string, pagination: PaginationInput) {
  const where = { propertyId, status: { not: "ARCHIVED" as const } };
  const [rows, total, published, scheduled, draft] = await getDatabase().$transaction([
    getDatabase().announcement.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paginationQuery(pagination),
      include: {
        building: { select: { id: true, name: true, code: true } },
        floor: { select: { id: true, number: true, label: true, buildingId: true } },
        rooms: { select: { room: { select: { id: true, number: true } } } },
      },
    }),
    getDatabase().announcement.count({ where }),
    getDatabase().announcement.count({ where: { propertyId, status: "PUBLISHED" } }),
    getDatabase().announcement.count({ where: { propertyId, status: "SCHEDULED" } }),
    getDatabase().announcement.count({ where: { propertyId, status: "DRAFT" } }),
  ]);
  const page = toPaginatedResult(rows, pagination);
  return {
    ...page,
    summary: { total, published, scheduled, draft },
  };
}

type AnnouncementTargets = Pick<
  UpdateAnnouncementInput,
  "audience" | "buildingId" | "floorId" | "roomIds"
>;

// ตรวจว่าอาคาร ชั้น หรือห้องที่เลือกอยู่ในหอนี้จริง
// กันส่ง id ของหออื่นมาเพื่อยิงประกาศข้ามหอ
async function validateTargets(propertyId: string, input: AnnouncementTargets) {
  if (input.audience === "BUILDING" && !input.buildingId) throw new ApiError(400, "กรุณาเลือกอาคาร");
  if (input.audience === "FLOOR" && !input.floorId) throw new ApiError(400, "กรุณาเลือกชั้น");
  if (input.audience === "ROOM" && !input.roomIds?.length) throw new ApiError(400, "กรุณาเลือกห้อง");
  if (input.buildingId && !await getDatabase().building.count({ where: { id: input.buildingId, propertyId } })) throw new ApiError(400, "อาคารไม่ถูกต้อง");
  if (input.floorId && !await getDatabase().floor.count({ where: { id: input.floorId, propertyId } })) throw new ApiError(400, "ชั้นไม่ถูกต้อง");
  if (input.roomIds?.length) {
    const ids = [...new Set(input.roomIds)];
    // นับแล้วเทียบจำนวน ไม่ครบแปลว่ามีห้องของหออื่นปนมา
    if (await getDatabase().room.count({ where: { id: { in: ids }, propertyId } }) !== ids.length) throw new ApiError(400, "มีห้องที่ไม่อยู่ในหอนี้");
  }
}

export async function createAnnouncement(propertyId: string, userId: string, input: CreateAnnouncementInput) {
  await validateTargets(propertyId, input);
  return getDatabase().announcement.create({
    data: {
      propertyId, createdById: userId, title: input.title, content: input.content,
      audience: input.audience, status: input.status,
      buildingId: input.audience === "BUILDING" ? input.buildingId : null,
      floorId: input.audience === "FLOOR" ? input.floorId : null,
      publishAt: input.publishAt,
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      rooms: input.audience === "ROOM" ? { create: [...new Set(input.roomIds)].map((roomId) => ({ roomId })) } : undefined,
    },
    select: { id: true, status: true, updatedAt: true },
  });
}

export async function updateAnnouncement(propertyId: string, announcementId: string, input: UpdateAnnouncementInput) {
  await validateTargets(propertyId, input);
  return getDatabase().$transaction(async (database) => {
    const current = await database.announcement.findFirst({ where: { id: announcementId, propertyId }, select: { id: true, updatedAt: true, audience: true } });
    if (!current) throw new ApiError(404, "ไม่พบประกาศ");
    // แยกสองฟิลด์ที่ไม่ได้เก็บลงตารางประกาศออก expectedUpdatedAt ใช้แค่ตรวจการแก้ชนกัน
    // ส่วน roomIds เก็บอยู่คนละตาราง ที่เหลือใน data คือคอลัมน์ของตารางนี้ล้วน ๆ
    const { expectedUpdatedAt, roomIds, ...data } = input;
    // เทียบเวลาที่แก้ล่าสุด ไม่ตรงแปลว่ามีคนอื่นแก้ไปก่อนแล้ว
    if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new ApiError(409, "ประกาศถูกแก้ไข กรุณาโหลดใหม่");
    if (roomIds || input.audience) await database.announcementRoom.deleteMany({ where: { announcementId } });
    return database.announcement.update({
      where: { id: announcementId },
      data: {
        ...data,
        buildingId: input.audience && input.audience !== "BUILDING" ? null : input.buildingId,
        floorId: input.audience && input.audience !== "FLOOR" ? null : input.floorId,
        ...(input.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
        ...(input.audience === "ROOM" && roomIds ? { rooms: { create: [...new Set(roomIds)].map((roomId) => ({ roomId })) } } : {}),
      },
      select: { id: true, status: true, updatedAt: true },
    });
  });
}

// ประกาศที่ผู้เช่าห้องนี้ควรเห็น
export async function listTenantAnnouncements(
  propertyId: string,
  buildingId: string,
  floorId: string,
  roomId: string,
  pagination: PaginationInput,
) {
  const now = new Date();
  return getDatabase().announcement.findMany({
    where: {
      propertyId,
      // รวมประกาศที่ตั้งเวลาไว้และถึงเวลาแล้วด้วย เผื่องานเบื้องหลังยังไม่ได้รันเปลี่ยนสถานะ
      // ผู้เช่าจะได้เห็นตรงเวลาโดยไม่ต้องรอรอบของงานนั้น
      OR: [{ status: "PUBLISHED" }, { status: "SCHEDULED", publishAt: { lte: now } }],
      // AND ครอบ OR ไว้อีกชั้น เพราะต้องผ่านทั้งเงื่อนไขสถานะและเงื่อนไขขอบเขตผู้รับ
      // เขียนรวมเป็น OR เดียวจะกลายเป็นผ่านข้อใดข้อหนึ่งก็พอ ซึ่งทำให้เห็นประกาศของห้องอื่น
      AND: [{
        OR: [
          { audience: "ALL_TENANTS" },
          { audience: "BUILDING", buildingId },
          { audience: "FLOOR", floorId },
          { audience: "ROOM", rooms: { some: { roomId } } },
        ],
      }],
    },
    orderBy: [{ publishedAt: "desc" }, { publishAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: { id: true, title: true, content: true, publishedAt: true, publishAt: true, createdAt: true },
  }).then((rows) => toPaginatedResult(rows, pagination));
}

export async function createParcel(propertyId: string, userId: string, input: CreateParcelInput, imageStorageKey?: string) {
  if (!await getDatabase().room.count({ where: { id: input.roomId, propertyId } })) throw new ApiError(404, "ไม่พบห้อง");
  if (input.recipientTenantId && !await getDatabase().roomOccupancy.count({
    where: {
      propertyId, roomId: input.roomId, tenantProfileId: input.recipientTenantId,
      status: "ACTIVE",
    },
  // ผู้รับที่ระบุต้องอยู่ห้องนั้นจริง กันลงทะเบียนพัสดุให้คนที่ไม่เกี่ยวข้อง
  })) throw new ApiError(400, "ผู้รับไม่ได้พักอยู่ในห้องนี้");
  return getDatabase().parcel.create({
    data: {
      propertyId, roomId: input.roomId, recipientTenantId: input.recipientTenantId,
      note: input.note, imageStorageKey, registeredById: userId,
    },
    select: { id: true, status: true, registeredAt: true },
  });
}

export async function listParcels(propertyId: string, pagination: PaginationInput) {
  const database = getDatabase();
  const now = new Date();
  const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(
    bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate(),
  ) - 7 * 60 * 60 * 1000);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const olderThanThreeDays = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const [rows, today, waiting, received, overdue] = await database.$transaction([
    database.parcel.findMany({
    where: { propertyId }, orderBy: [{ registeredAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, status: true, note: true, registeredAt: true, receivedAt: true, updatedAt: true, imageStorageKey: true,
      recipientTenant: { select: { id: true, user: { select: { displayName: true } } } },
      room: {
        select: {
          id: true, number: true,
          occupancies: {
            where: { status: "ACTIVE", role: "PRIMARY" },
            take: 1,
            select: { tenantProfile: { select: { user: { select: { displayName: true } } } } },
          },
        },
      },
    },
    }),
    database.parcel.count({ where: { propertyId, registeredAt: { gte: todayStart, lt: tomorrowStart } } }),
    database.parcel.count({ where: { propertyId, status: "WAITING" } }),
    database.parcel.count({ where: { propertyId, status: "RECEIVED" } }),
    database.parcel.count({ where: { propertyId, status: "WAITING", registeredAt: { lt: olderThanThreeDays } } }),
  ]);
  return {
    ...toPaginatedResult(
    rows.map(({ imageStorageKey, ...row }) => ({ ...row, imageUrl: imageStorageKey ? `/api/v1/admin/properties/${propertyId}/parcels/${row.id}/image` : null })),
    pagination,
    ),
    summary: { today, waiting, received, olderThanThreeDays: overdue },
  };
}

export async function updateParcel(propertyId: string, parcelId: string, input: UpdateParcelInput) {
  const parcel = await getDatabase().parcel.findFirst({ where: { id: parcelId, propertyId, status: "WAITING" }, select: { id: true, roomId: true, updatedAt: true } });
  if (!parcel) throw new ApiError(404, "ไม่พบพัสดุที่ดำเนินการได้");
  if (input.expectedUpdatedAt && parcel.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) throw new ApiError(409, "รายการพัสดุถูกแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่");
  if (input.receivedByTenantId && !await getDatabase().roomOccupancy.count({
    where: { roomId: parcel.roomId, tenantProfileId: input.receivedByTenantId, status: "ACTIVE" },
  // ผู้รับที่ระบุต้องอยู่ห้องนั้นจริง กันลงทะเบียนพัสดุให้คนที่ไม่เกี่ยวข้อง
  })) throw new ApiError(400, "ผู้รับไม่ได้พักอยู่ในห้องนี้");
  const result = await getDatabase().parcel.updateMany({
    where: { id: parcel.id, status: "WAITING", ...(input.expectedUpdatedAt ? { updatedAt: input.expectedUpdatedAt } : {}) },
    data: { ...(input.status ? { status: input.status, receivedAt: input.status === "RECEIVED" ? new Date() : null, receivedByTenantId: input.receivedByTenantId } : {}), ...(input.note !== undefined ? { note: input.note } : {}) },
  });
  // ใส่เงื่อนไขไว้ใน where แล้วนับจำนวนแถวที่แก้ได้ สองคนกดรับพร้อมกันจะสำเร็จแค่คนเดียว
  if (result.count !== 1) throw new ApiError(409, "รายการพัสดุถูกแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่");
  return getDatabase().parcel.findUniqueOrThrow({ where: { id: parcel.id }, select: { id: true, status: true, receivedAt: true, updatedAt: true } });
}

export async function listTenantParcels(
  tenantProfileId: string,
  roomId: string,
  pagination: PaginationInput,
  view: TenantRecordView = "current",
) {
  const where = {
    roomId,
    status: { in: [...TENANT_PARCEL_VIEW_STATUSES[view]] },
    OR: [{ recipientTenantId: tenantProfileId }, { recipientTenantId: null }],
  };
  const [rows, total] = await getDatabase().$transaction([
    getDatabase().parcel.findMany({
      where,
      orderBy: [{ registeredAt: "desc" }, { id: "desc" }],
      ...paginationQuery(pagination),
      select: { id: true, status: true, note: true, registeredAt: true, receivedAt: true, imageStorageKey: true },
    }),
    getDatabase().parcel.count({ where }),
  ]);
  return toPaginatedResult(
    rows.map(({ imageStorageKey, ...row }) => ({ ...row, imageUrl: imageStorageKey ? `/api/v1/tenant/parcels/${row.id}/image` : null })),
    pagination,
    total,
  );
}

export async function createTenantTicket(input: {
  propertyId: string; roomId: string; tenantProfileId: string; userId: string; data: CreateTicketInput;
}) {
  return getDatabase().$transaction(async (database) => {
    const ticket = await database.serviceTicket.create({
      data: {
        propertyId: input.propertyId, roomId: input.roomId, tenantProfileId: input.tenantProfileId,
        createdByUserId: input.userId, ...input.data,
      },
      select: { id: true, type: true, status: true, priority: true, createdAt: true },
    });
    await database.ticketEvent.create({
      data: { ticketId: ticket.id, type: "CREATED", actorUserId: input.userId, toValue: ticket.status },
    });
    return ticket;
  });
}

export async function listAdminTickets(
  propertyId: string,
  viewerUserId: string,
  pagination: PaginationInput,
  type?: "REPAIR" | "COMPLAINT",
  status?: "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED",
) {
  const rows = await getDatabase().serviceTicket.findMany({
    where: { propertyId, ...(type ? { type } : {}), ...(status ? { status } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, type: true, status: true, priority: true, title: true, detail: true, isAnonymous: true,
      createdAt: true, updatedAt: true, resolvedAt: true,
      room: { select: { id: true, number: true } },
      tenantProfile: { select: { id: true, user: { select: { displayName: true } } } },
      attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
      replies: {
        where: { authorUser: { role: "TENANT" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { createdAt: true },
      },
      readStates: { where: { userId: viewerUserId }, take: 1, select: { lastReadAt: true } },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true, type: true, fromValue: true, toValue: true, createdAt: true,
          attachmentId: true,
          actorUser: { select: { id: true, displayName: true, role: true } },
        },
      },
    },
  });
  return toPaginatedResult(
    rows.map((row) => ({
      ...row,
      hasUnreadReply: Boolean(row.replies[0] && (!row.readStates[0] || row.replies[0].createdAt > row.readStates[0].lastReadAt)),
      replies: undefined,
      readStates: undefined,
      tenantProfile: row.isAnonymous ? null : row.tenantProfile,
      events: row.events.map((event) => ({
        ...event,
        actorUser: row.isAnonymous && event.type === "CREATED" ? null : event.actorUser,
      })),
    })),
    pagination,
  );
}

export async function listTenantTickets(tenantProfileId: string, viewerUserId: string, pagination: PaginationInput, view: TenantRecordView = "current") {
  const where = { tenantProfileId, status: { in: [...TENANT_TICKET_VIEW_STATUSES[view]] } };
  const [rows, total] = await getDatabase().$transaction([
    getDatabase().serviceTicket.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paginationQuery(pagination),
      select: {
      id: true, type: true, status: true, priority: true, title: true, detail: true,
      createdAt: true, updatedAt: true, resolvedAt: true,
      attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } },
      replies: {
        where: { authorUser: { role: { in: ["PROPERTY_ADMIN", "SUPER_ADMIN"] } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { createdAt: true },
      },
      readStates: { where: { userId: viewerUserId }, take: 1, select: { lastReadAt: true } },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true, type: true, fromValue: true, toValue: true, createdAt: true,
          attachmentId: true,
        },
      },
      },
    }),
    getDatabase().serviceTicket.count({ where }),
  ]);
  return toPaginatedResult(rows.map((row) => ({
    ...row,
    hasUnreadReply: Boolean(row.replies[0] && (!row.readStates[0] || row.replies[0].createdAt > row.readStates[0].lastReadAt)),
    replies: undefined,
    readStates: undefined,
  })), pagination, total);
}

// ด่านตรวจก่อนแก้เรื่องแจ้ง ทั้งการชนกันของการแก้ไข สถานะที่ปิดแล้ว และเส้นทางสถานะที่อนุญาต
function assertTicketUpdatable(ticket: { priority: string; status: keyof typeof ticketTransitions; updatedAt: Date }, input: UpdateTicketInput) {
  if (input.expectedUpdatedAt && ticket.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
    throw new ApiError(409, "เรื่องร้องเรียนถูกแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่");
  }
  // เรื่องที่ปิดแล้วเปลี่ยนได้แค่สถานะ เนื้อหาและความสำคัญต้องคงไว้เป็นหลักฐาน
  const editsContent = input.title !== undefined || input.detail !== undefined || input.priority !== undefined;
  if (["RESOLVED", "CANCELLED"].includes(ticket.status) && editsContent) {
    throw new ApiError(409, "ไม่สามารถแก้ไขเรื่องที่ปิดแล้วได้");
  }
  if (input.status && !(ticketTransitions[ticket.status] as readonly string[]).includes(input.status)) {
    throw new ApiError(409, "ไม่สามารถเปลี่ยนสถานะรายการแบบนี้ได้");
  }
}

// ฟิลด์ที่จะเขียนทับ ส่งมาเฉพาะที่ระบุ ไม่ส่งมาก็ไม่แตะของเดิม
function ticketUpdateData(input: UpdateTicketInput) {
  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
    ...(input.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
    ...(input.status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
  };
}

// บันทึกไว้ในไทม์ไลน์เฉพาะค่าที่เปลี่ยนจริง ส่งค่าเดิมซ้ำมาก็ไม่ต้องจด
function ticketChangeEvents(ticket: { priority: string; status: string }, input: UpdateTicketInput, ticketId: string, actorUserId: string) {
  const events = [];
  if (input.status && input.status !== ticket.status) {
    events.push({ ticketId, type: "STATUS_CHANGED" as const, actorUserId, fromValue: ticket.status, toValue: input.status });
  }
  if (input.priority && input.priority !== ticket.priority) {
    events.push({ ticketId, type: "PRIORITY_CHANGED" as const, actorUserId, fromValue: ticket.priority, toValue: input.priority });
  }
  return events;
}

export async function updateTicket(
  propertyId: string,
  ticketId: string,
  actorUserId: string,
  input: UpdateTicketInput,
) {
  return getDatabase().$transaction(async (database) => {
    const ticket = await database.serviceTicket.findFirst({
      where: { id: ticketId, propertyId },
      select: { id: true, status: true, priority: true, updatedAt: true },
    });
    if (!ticket) throw new ApiError(404, "ไม่พบรายการแจ้งเรื่อง");
    assertTicketUpdatable(ticket, input);

    const result = await database.serviceTicket.updateMany({
      where: { id: ticket.id, ...(input.expectedUpdatedAt ? { updatedAt: input.expectedUpdatedAt } : {}) },
      data: ticketUpdateData(input),
    });
    // แก้ไม่โดนแถวเลย แปลว่ามีคนบันทึกแทรกไปก่อนระหว่างที่เราตรวจอยู่
    if (result.count !== 1) throw new ApiError(409, "เรื่องร้องเรียนถูกแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่");

    const events = ticketChangeEvents(ticket, input, ticket.id, actorUserId);
    if (events.length) await database.ticketEvent.createMany({ data: events });

    return database.serviceTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      select: { id: true, status: true, priority: true, updatedAt: true },
    });
  });
}

export async function attachTicketFile(
  ticketId: string,
  actorUserId: string,
  storageKey: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
) {
  return getDatabase().$transaction(async (database) => {
    const attachment = await database.ticketAttachment.create({
      data: { ticketId, storageKey, fileName, mimeType, sizeBytes },
      select: { id: true },
    });
    await database.ticketEvent.create({
      data: {
        ticketId, type: "ATTACHMENT_ADDED", actorUserId,
        attachmentId: attachment.id, toValue: fileName,
      },
    });
    return attachment;
  });
}

// ดึงเรื่องแจ้งพร้อมตรวจว่าเป็นของผู้เช่าคนนี้ ในคำสั่งเดียว
export async function requireTenantTicket(tenantProfileId: string, ticketId: string) {
  const ticket = await getDatabase().serviceTicket.findFirst({ where: { id: ticketId, tenantProfileId }, select: { id: true, propertyId: true } });
  if (!ticket) throw new ApiError(404, "ไม่พบรายการแจ้งเรื่อง");
  return ticket;
}

export async function listTicketReplies(input: {
  ticketId: string;
  viewerUserId: string;
  pagination: PaginationInput;
  propertyId?: string;
  tenantProfileId?: string;
}) {
  const database = getDatabase();
  const ticket = await database.serviceTicket.findFirst({
    where: {
      id: input.ticketId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      ...(input.tenantProfileId ? { tenantProfileId: input.tenantProfileId } : {}),
    },
    select: { id: true },
  });
  if (!ticket) throw new ApiError(404, "ไม่พบรายการแจ้งเรื่อง");

  const rows = await database.ticketReply.findMany({
    where: { ticketId: ticket.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(input.pagination),
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorUser: { select: { id: true, displayName: true, role: true } },
    },
  });
  const latestReply = await database.ticketReply.findFirst({
    where: { ticketId: ticket.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  await database.ticketReadState.upsert({
    where: { ticketId_userId: { ticketId: ticket.id, userId: input.viewerUserId } },
    create: {
      ticketId: ticket.id,
      userId: input.viewerUserId,
      lastReadAt: new Date(),
      lastReadReplyId: latestReply?.id,
    },
    update: { lastReadAt: new Date(), lastReadReplyId: latestReply?.id },
  });
  const page = toPaginatedResult(rows, input.pagination);
  return { ...page, data: [...page.data].reverse() };
}

export async function createTicketReply(input: {
  ticketId: string;
  actorUserId: string;
  data: CreateTicketReplyInput;
  propertyId?: string;
  tenantProfileId?: string;
}) {
  return getDatabase().$transaction(async (database) => {
    const ticket = await database.serviceTicket.findFirst({
      where: {
        id: input.ticketId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        ...(input.tenantProfileId ? { tenantProfileId: input.tenantProfileId } : {}),
      },
      select: { id: true, status: true },
    });
    if (!ticket) throw new ApiError(404, "ไม่พบรายการแจ้งเรื่อง");
    if (ticket.status === "CANCELLED") throw new ApiError(409, "รายการนี้ถูกยกเลิกแล้ว");

    const reply = await database.ticketReply.create({
      data: { ticketId: ticket.id, authorUserId: input.actorUserId, body: input.data.body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        authorUser: { select: { id: true, displayName: true, role: true } },
      },
    });
    await database.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: "REPLY_ADDED",
        actorUserId: input.actorUserId,
        replyId: reply.id,
      },
    });
    await database.ticketReadState.upsert({
      where: { ticketId_userId: { ticketId: ticket.id, userId: input.actorUserId } },
      create: {
        ticketId: ticket.id,
        userId: input.actorUserId,
        lastReadAt: reply.createdAt,
        lastReadReplyId: reply.id,
      },
      update: { lastReadAt: reply.createdAt, lastReadReplyId: reply.id },
    });
    return reply;
  });
}

// นับคำตอบที่ยังไม่ได้อ่านในเรื่องแจ้ง แยกจากข้อความแชทซึ่งนับคนละที่
export async function countUnreadTicketReplies(input: {
  viewerUserId: string;
  propertyId?: string;
  tenantProfileId?: string;
  incomingRoles: Array<"SUPER_ADMIN" | "PROPERTY_ADMIN" | "TENANT">;
}) {
  const tickets = await getDatabase().serviceTicket.findMany({
    where: {
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      ...(input.tenantProfileId ? { tenantProfileId: input.tenantProfileId } : {}),
      replies: { some: { authorUser: { role: { in: input.incomingRoles } } } },
    },
    select: {
      replies: {
        where: { authorUser: { role: { in: input.incomingRoles } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { createdAt: true },
      },
      readStates: { where: { userId: input.viewerUserId }, take: 1, select: { lastReadAt: true } },
    },
  });
  return tickets.reduce((count, ticket) => (
    ticket.replies[0] && (!ticket.readStates[0] || ticket.replies[0].createdAt > ticket.readStates[0].lastReadAt)
      ? count + 1
      : count
  ), 0);
}

// ตรวจสิทธิ์ก่อนคืนที่อยู่ไฟล์แนบ ผู้เรียกจึงจะเอาไปอ่านไฟล์ได้
export async function getTicketAttachment(input: {
  attachmentId: string;
  ticketId: string;
  propertyId?: string;
  tenantProfileId?: string;
}) {
  const attachment = await getDatabase().ticketAttachment.findFirst({
    where: {
      id: input.attachmentId,
      ticket: {
        id: input.ticketId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        ...(input.tenantProfileId ? { tenantProfileId: input.tenantProfileId } : {}),
      },
    },
    select: { storageKey: true, fileName: true, mimeType: true },
  });
  if (!attachment) throw new ApiError(404, "ไม่พบไฟล์");
  return attachment;
}

// รูปพัสดุก็เช่นกัน ต้องเป็นคนในห้องนั้นหรือเจ้าของหอถึงจะเปิดดูได้
export async function getParcelImage(input: {
  parcelId: string;
  propertyId?: string;
  roomId?: string;
  tenantProfileId?: string;
}) {
  const parcel = await getDatabase().parcel.findFirst({
    where: {
      id: input.parcelId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      ...(input.roomId ? { roomId: input.roomId } : {}),
      ...(input.tenantProfileId ? {
        OR: [{ recipientTenantId: input.tenantProfileId }, { recipientTenantId: null }],
      } : {}),
    },
    select: { imageStorageKey: true },
  });
  if (!parcel?.imageStorageKey) throw new ApiError(404, "ไม่พบรูปภาพ");
  return parcel.imageStorageKey;
}
