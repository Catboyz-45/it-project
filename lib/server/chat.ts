/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “chat” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";
import { ApiError } from "@/lib/server/api";
import type { ChatConversationType, ChatSenderRole } from "@/generated/prisma/client";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Chat Message Dto” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ChatMessageDto = {
  id: string;
  tenantId: string;
  body: string;
  senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN";
  senderName: string;
  createdAt: string;
  attachment: { name: string; mimeType: string; size: number; url: string } | null;
};

const messageSelect = {
  id: true,
  body: true,
  senderRole: true,
  createdAt: true,
  attachmentName: true,
  attachmentMime: true,
  attachmentSize: true,
  conversation: { select: { tenantExternalId: true, propertyId: true } },
  senderUser: { select: { displayName: true } },
} as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Selected Message” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type SelectedMessage = Awaited<ReturnType<typeof getDatabase>>["chatMessage"] extends never ? never : {
  id: string;
  body: string;
  senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN";
  createdAt: Date;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  conversation: { tenantExternalId: string | null; propertyId: string };
  senderUser: { displayName: string } | null;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “to Chat Message Dto” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - message: ค่า “message” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด ChatMessageDto ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function toChatMessageDto(message: SelectedMessage): ChatMessageDto {
  return {
    id: message.id,
    tenantId: message.conversation.tenantExternalId ?? "",
    body: message.body,
    senderRole: message.senderRole,
    senderName: message.senderUser?.displayName ?? (
      message.senderRole === "TENANT" ? "ผู้เช่า"
        : message.senderRole === "SUPER_ADMIN" ? "Super Admin" : "ผู้ดูแล"
    ),
    createdAt: message.createdAt.toISOString(),
    attachment: message.attachmentName && message.attachmentMime && message.attachmentSize !== null
      ? {
          name: message.attachmentName,
          mimeType: message.attachmentMime,
          size: message.attachmentSize,
          url: `/api/v1/chat/messages/${message.id}/attachment?propertyId=${encodeURIComponent(message.conversation.propertyId)}`,
        }
      : null,
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Tenant Messages” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - tenantId: รหัสภายในของ tenant
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listTenantMessages(
  propertyId: string,
  tenantId: string,
  pagination: PaginationInput,
) {
  const messages = await getDatabase().chatMessage.findMany({
    where: { propertyId, conversation: { type: "TENANT_PROPERTY", tenantExternalId: tenantId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: messageSelect,
  });
  const page = toPaginatedResult(messages.map(toChatMessageDto), pagination);
  return { ...page, data: page.data.reverse() };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Property Messages After” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - after: ค่า “after” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listPropertyMessagesAfter(propertyId: string, after: Date) {
  const messages = await getDatabase().chatMessage.findMany({
    where: { propertyId, createdAt: { gt: after }, conversation: { type: "TENANT_PROPERTY" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: messageSelect,
  });
  return messages.map(toChatMessageDto);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “send Admin Message” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function sendAdminMessage(input: {
  propertyId: string;
  userId: string;
  tenantId: string;
  tenantName: string;
  roomNumber: string;
  body: string;
  clientId: string;
  attachment?: { key: string; mimeType: string; name: string; size: number };
}) {
  return getDatabase().$transaction(async (database) => {
    const conversationKey = `LEGACY:${input.tenantId}`;
    const conversation = await database.chatConversation.upsert({
      where: { propertyId_conversationKey: { propertyId: input.propertyId, conversationKey } },
      create: {
        propertyId: input.propertyId,
        conversationKey,
        tenantExternalId: input.tenantId,
        tenantName: input.tenantName,
        roomNumber: input.roomNumber,
      },
      update: { tenantName: input.tenantName, roomNumber: input.roomNumber },
      select: { id: true },
    });
    const existing = await database.chatMessage.findUnique({
      where: { conversationId_clientId: { conversationId: conversation.id, clientId: input.clientId } },
      select: messageSelect,
    });
    if (existing) return toChatMessageDto(existing);
    const message = await database.chatMessage.create({
      data: {
        propertyId: input.propertyId,
        conversationId: conversation.id,
        senderRole: "ADMIN",
        senderUserId: input.userId,
        body: input.body,
        attachmentKey: input.attachment?.key,
        attachmentMime: input.attachment?.mimeType,
        attachmentName: input.attachment?.name,
        attachmentSize: input.attachment?.size,
        clientId: input.clientId,
      },
      select: messageSelect,
    });
    await database.chatConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: message.createdAt } });
    return toChatMessageDto(message);
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Conversation Actor” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ConversationActor = {
  userId: string;
  role: "PROPERTY_ADMIN" | "TENANT" | "SUPER_ADMIN";
  propertyId: string;
  tenantProfileId?: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Conversation Dto” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ConversationDto = {
  id: string;
  type: ChatConversationType;
  propertyId: string;
  propertyName: string;
  tenant: { id: string; name: string; roomNumber: string } | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “sender Role For” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - actor: ค่า “actor” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด ChatSenderRole ตามสัญญา TypeScript ของฟังก์ชัน
 */
function senderRoleFor(actor: ConversationActor): ChatSenderRole {
  if (actor.role === "TENANT") return "TENANT";
  if (actor.role === "SUPER_ADMIN") return "SUPER_ADMIN";
  return "ADMIN";
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Conversation Access” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - conversation: ค่า “conversation” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - actor: ค่า “actor” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
function assertConversationAccess(
  conversation: { propertyId: string; type: ChatConversationType; tenantProfileId: string | null },
  actor: ConversationActor,
) {
  if (conversation.propertyId !== actor.propertyId) throw new ApiError(404, "ไม่พบบทสนทนา");
  if (actor.role === "TENANT" && (
    conversation.type !== "TENANT_PROPERTY" ||
    conversation.tenantProfileId !== actor.tenantProfileId
  )) throw new ApiError(404, "ไม่พบบทสนทนา");
  if (actor.role === "SUPER_ADMIN" && conversation.type !== "PROPERTY_SUPPORT") {
    throw new ApiError(404, "ไม่พบบทสนทนา");
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “ensure Tenant Conversation” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function ensureTenantConversation(input: {
  propertyId: string;
  tenantProfileId: string;
  tenantName: string;
  roomNumber: string;
}) {
  const conversationKey = `TENANT:${input.tenantProfileId}`;
  return getDatabase().chatConversation.upsert({
    where: { propertyId_conversationKey: { propertyId: input.propertyId, conversationKey } },
    create: {
      propertyId: input.propertyId,
      type: "TENANT_PROPERTY",
      conversationKey,
      tenantProfileId: input.tenantProfileId,
      tenantName: input.tenantName,
      roomNumber: input.roomNumber,
    },
    update: { tenantName: input.tenantName, roomNumber: input.roomNumber },
    select: { id: true },
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “ensure Support Conversation” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function ensureSupportConversation(propertyId: string) {
  return getDatabase().chatConversation.upsert({
    where: { propertyId_conversationKey: { propertyId, conversationKey: "PROPERTY_SUPPORT" } },
    create: { propertyId, type: "PROPERTY_SUPPORT", conversationKey: "PROPERTY_SUPPORT" },
    update: {},
    select: { id: true },
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Conversations” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - actor: ค่า “actor” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listConversations(
  actor: ConversationActor,
  type: ChatConversationType,
  pagination: PaginationInput,
) {
  if (actor.role === "TENANT" && type !== "TENANT_PROPERTY") throw new ApiError(403, "คุณไม่มีสิทธิ์ดำเนินการ");
  if (actor.role === "SUPER_ADMIN" && type !== "PROPERTY_SUPPORT") throw new ApiError(403, "คุณไม่มีสิทธิ์ดำเนินการ");
  const readField = actor.role === "TENANT" ? "lastTenantReadAt"
    : actor.role === "SUPER_ADMIN" ? "lastSuperAdminReadAt" : "lastAdminReadAt";
  const rows = await getDatabase().chatConversation.findMany({
    where: {
      propertyId: actor.propertyId,
      type,
      ...(actor.role === "TENANT" ? { tenantProfileId: actor.tenantProfileId } : {}),
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, type: true, propertyId: true, tenantProfileId: true,
      tenantName: true, roomNumber: true, lastMessageAt: true,
      lastTenantReadAt: true, lastAdminReadAt: true, lastSuperAdminReadAt: true,
      property: { select: { name: true } },
    },
  });
  const page = toPaginatedResult(rows, pagination);
  const data: ConversationDto[] = await Promise.all(page.data.map(async (row) => {
    const readAt = row[readField];
    const unreadCount = await getDatabase().chatMessage.count({
      where: {
        conversationId: row.id,
        senderRole: { not: senderRoleFor(actor) },
        ...(readAt ? { createdAt: { gt: readAt } } : {}),
      },
    });
    return {
      id: row.id,
      type: row.type,
      propertyId: row.propertyId,
      propertyName: row.property.name,
      tenant: row.tenantProfileId ? {
        id: row.tenantProfileId,
        name: row.tenantName ?? "ผู้เช่า",
        roomNumber: row.roomNumber ?? "-",
      } : null,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      unreadCount,
    };
  }));
  return { data, pageInfo: page.pageInfo };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Super Admin Support Conversations” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listSuperAdminSupportConversations(pagination: PaginationInput) {
  const rows = await getDatabase().chatConversation.findMany({
    where: { type: "PROPERTY_SUPPORT" },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, type: true, propertyId: true, lastMessageAt: true, lastSuperAdminReadAt: true,
      property: { select: { name: true } },
      _count: {
        select: {
          messages: { where: { senderRole: { not: "SUPER_ADMIN" } } },
        },
      },
    },
  });
  const page = toPaginatedResult(rows, pagination);
  const data: ConversationDto[] = await Promise.all(page.data.map(async (row) => {
    const unreadCount = row.lastSuperAdminReadAt
      ? await getDatabase().chatMessage.count({
          where: {
            conversationId: row.id,
            senderRole: { not: "SUPER_ADMIN" },
            createdAt: { gt: row.lastSuperAdminReadAt },
          },
        })
      : row._count.messages;
    return {
      id: row.id,
      type: row.type,
      propertyId: row.propertyId,
      propertyName: row.property.name,
      tenant: null,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      unreadCount,
    };
  }));
  return { data, pageInfo: page.pageInfo };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Conversation Messages” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - conversationId: รหัสภายในของ conversation
 * - actor: ค่า “actor” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - options: ตัวเลือกเพิ่มเติมที่ปรับพฤติกรรมของฟังก์ชัน
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listConversationMessages(
  conversationId: string,
  actor: ConversationActor,
  options: { before?: Date; beforeMessageId?: string; limit: number },
) {
  const conversation = await getDatabase().chatConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, propertyId: true, type: true, tenantProfileId: true },
  });
  if (!conversation) throw new ApiError(404, "ไม่พบบทสนทนา");
  assertConversationAccess(conversation, actor);
  const messages = await getDatabase().chatMessage.findMany({
    where: {
      conversationId,
      ...(!options.beforeMessageId && options.before ? { createdAt: { lt: options.before } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(options.beforeMessageId ? { cursor: { id: options.beforeMessageId }, skip: 1 } : {}),
    take: options.limit + 1,
    select: messageSelect,
  });
  const hasMore = messages.length > options.limit;
  const page = hasMore ? messages.slice(0, options.limit) : messages;
  return { messages: page.reverse().map(toChatMessageDto), hasMore };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Conversation Messages After” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - conversationId: รหัสภายในของ conversation
 * - actor: ค่า “actor” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - after: ค่า “after” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listConversationMessagesAfter(
  conversationId: string,
  actor: ConversationActor,
  after: Date,
) {
  const conversation = await getDatabase().chatConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, propertyId: true, type: true, tenantProfileId: true },
  });
  if (!conversation) throw new ApiError(404, "ไม่พบบทสนทนา");
  assertConversationAccess(conversation, actor);
  const messages = await getDatabase().chatMessage.findMany({
    where: { conversationId, createdAt: { gt: after } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: messageSelect,
  });
  return messages.map(toChatMessageDto);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “send Conversation Message” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function sendConversationMessage(input: {
  conversationId: string;
  actor: ConversationActor;
  body: string;
  clientId: string;
  attachment?: { key: string; mimeType: string; name: string; size: number };
}) {
  return getDatabase().$transaction(async (database) => {
    const conversation = await database.chatConversation.findUnique({
      where: { id: input.conversationId },
      select: { id: true, propertyId: true, type: true, tenantProfileId: true },
    });
    if (!conversation) throw new ApiError(404, "ไม่พบบทสนทนา");
    assertConversationAccess(conversation, input.actor);
    const existing = await database.chatMessage.findUnique({
      where: { conversationId_clientId: { conversationId: conversation.id, clientId: input.clientId } },
      select: messageSelect,
    });
    if (existing) return toChatMessageDto(existing);
    const message = await database.chatMessage.create({
      data: {
        propertyId: conversation.propertyId,
        conversationId: conversation.id,
        senderRole: senderRoleFor(input.actor),
        senderUserId: input.actor.userId,
        body: input.body,
        clientId: input.clientId,
        attachmentKey: input.attachment?.key,
        attachmentMime: input.attachment?.mimeType,
        attachmentName: input.attachment?.name,
        attachmentSize: input.attachment?.size,
      },
      select: messageSelect,
    });
    await database.chatConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });
    return toChatMessageDto(message);
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “mark Conversation Read” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - conversationId: รหัสภายในของ conversation
 * - actor: ค่า “actor” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function markConversationRead(conversationId: string, actor: ConversationActor) {
  const conversation = await getDatabase().chatConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, propertyId: true, type: true, tenantProfileId: true },
  });
  if (!conversation) throw new ApiError(404, "ไม่พบบทสนทนา");
  assertConversationAccess(conversation, actor);
  const field = actor.role === "TENANT" ? "lastTenantReadAt"
    : actor.role === "SUPER_ADMIN" ? "lastSuperAdminReadAt" : "lastAdminReadAt";
  await getDatabase().chatConversation.update({
    where: { id: conversation.id },
    data: { [field]: new Date() },
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Authorized Chat Attachment” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - messageId: รหัสภายในของ message
 * - actor: ค่า “actor” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getAuthorizedChatAttachment(messageId: string, actor: ConversationActor) {
  const message = await getDatabase().chatMessage.findUnique({
    where: { id: messageId },
    select: {
      attachmentKey: true, attachmentMime: true, attachmentName: true,
      conversation: { select: { propertyId: true, type: true, tenantProfileId: true } },
    },
  });
  if (!message) throw new ApiError(404, "ไม่พบไฟล์");
  assertConversationAccess(message.conversation, actor);
  if (!message.attachmentKey || !message.attachmentMime || !message.attachmentName) {
    throw new ApiError(404, "ไม่พบไฟล์");
  }
  return {
    attachmentKey: message.attachmentKey,
    attachmentMime: message.attachmentMime,
    attachmentName: message.attachmentName,
  };
}
