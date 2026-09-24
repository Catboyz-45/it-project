import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";
import { ApiError } from "@/lib/server/api";
import type { ChatConversationType, ChatSenderRole } from "@/generated/prisma/client";

// บัญชีคนส่งถูกลบไปแล้วก็ยังแสดงบทบาทได้ ข้อความจะได้ไม่กลายเป็นของคนไม่มีชื่อ
const senderRoleLabels: Record<string, string> = {
  TENANT: "ผู้เช่า",
  SUPER_ADMIN: "Super Admin",
};

// แต่ละบทบาทมีช่องเก็บเวลาอ่านล่าสุดของตัวเอง จะได้นับข้อความใหม่แยกกันได้
function readFieldFor(role: string) {
  if (role === "TENANT") return "lastTenantReadAt" as const;
  return role === "SUPER_ADMIN" ? "lastSuperAdminReadAt" as const : "lastAdminReadAt" as const;
}

export type ChatMessageDto = {
  id: string;
  tenantId: string;
  body: string;
  senderRole: "ADMIN" | "TENANT" | "SUPER_ADMIN";
  senderName: string;
  createdAt: string;
  attachment: { name: string; mimeType: string; size: number; url: string } | null;
};

// เลือกเฉพาะฟิลด์ที่ใช้จริง ไม่มี attachmentKey เพราะที่อยู่ไฟล์ไม่ควรหลุดไปฝั่งเบราว์เซอร์
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

// แปลงแถวจากฐานข้อมูลเป็นรูปแบบที่ส่งออกไป ทุก endpoint ใช้ตัวนี้ รูปแบบจะได้เหมือนกันหมด
export function toChatMessageDto(message: SelectedMessage): ChatMessageDto {
  return {
    id: message.id,
    tenantId: message.conversation.tenantExternalId ?? "",
    body: message.body,
    senderRole: message.senderRole,
    // บัญชีคนส่งถูกลบไปแล้วก็ยังแสดงบทบาทได้ ข้อความจะได้ไม่กลายเป็นของคนไม่มีชื่อ
    senderName: message.senderUser?.displayName ?? senderRoleLabels[message.senderRole] ?? "ผู้ดูแล",
    createdAt: message.createdAt.toISOString(),
    attachment: message.attachmentName && message.attachmentMime && message.attachmentSize !== null
      ? {
          name: message.attachmentName,
          mimeType: message.attachmentMime,
          size: message.attachmentSize,
          // ไฟล์ผ่าน API ที่ตรวจสิทธิ์ก่อน ไม่ได้ส่งที่อยู่จริงในที่เก็บออกไป
          url: `/api/v1/chat/messages/${message.id}/attachment?propertyId=${encodeURIComponent(message.conversation.propertyId)}`,
        }
      : null,
  };
}

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
  // ดึงใหม่สุดก่อนเพื่อให้แบ่งหน้าได้ถูก แล้วค่อยกลับลำดับตอนส่งออก
  // เพราะหน้าจอต้องเรียงเก่าไปใหม่แบบห้องสนทนาทั่วไป
  const page = toPaginatedResult(messages.map(toChatMessageDto), pagination);
  return { ...page, data: page.data.reverse() };
}

export async function listPropertyMessagesAfter(propertyId: string, after: Date) {
  const messages = await getDatabase().chatMessage.findMany({
    where: { propertyId, createdAt: { gt: after }, conversation: { type: "TENANT_PROPERTY" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: messageSelect,
  });
  return messages.map(toChatMessageDto);
}

// ทางเดิมที่ยังมีของเก่าใช้อยู่ อ้างผู้เช่าด้วย id ภายนอก ไม่ใช่ id ของโปรไฟล์
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
    // clientId ที่ฝั่งเบราว์เซอร์สร้าง ใช้กันบันทึกซ้ำ ส่งคำขอเดิมมาอีกรอบจะได้ข้อความเดิมกลับไป
    // จำเป็นเพราะเน็ตหลุดแล้วกดส่งใหม่ ไม่ควรกลายเป็นสองข้อความ
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

export type ConversationActor = {
  userId: string;
  role: "PROPERTY_ADMIN" | "TENANT" | "SUPER_ADMIN";
  propertyId: string;
  tenantProfileId?: string;
};

export type ConversationDto = {
  id: string;
  type: ChatConversationType;
  propertyId: string;
  propertyName: string;
  tenant: { id: string; name: string; roomNumber: string } | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

// บทบาทของผู้ส่งมาจากฝั่งเซิร์ฟเวอร์เสมอ ไม่เอาที่ฝั่งเบราว์เซอร์ส่งมา
function senderRoleFor(actor: ConversationActor): ChatSenderRole {
  if (actor.role === "TENANT") return "TENANT";
  if (actor.role === "SUPER_ADMIN") return "SUPER_ADMIN";
  return "ADMIN";
}

// ด่านตรวจสิทธิ์ของแชท ทุกทางเข้าต้องผ่านตัวนี้ ไม่ว่าจะอ่าน ส่ง หรือโหลดไฟล์แนบ
// ทุกกรณีที่ไม่ผ่านตอบว่าไม่พบ ไม่บอกว่ามีบทสนทนาอยู่แต่เข้าไม่ได้
function assertConversationAccess(
  conversation: { propertyId: string; type: ChatConversationType; tenantProfileId: string | null },
  actor: ConversationActor,
) {
  if (conversation.propertyId !== actor.propertyId) throw new ApiError(404, "ไม่พบบทสนทนา");
  // ผู้เช่าเข้าได้เฉพาะห้องสนทนาของตัวเอง และต้องเป็นชนิดคุยกับหอเท่านั้น
  if (actor.role === "TENANT" && (
    conversation.type !== "TENANT_PROPERTY" ||
    conversation.tenantProfileId !== actor.tenantProfileId
  )) throw new ApiError(404, "ไม่พบบทสนทนา");
  // ผู้ดูแลระบบเข้าได้เฉพาะห้องช่วยเหลือ ไม่เห็นบทสนทนาระหว่างเจ้าของหอกับผู้เช่า
  if (actor.role === "SUPER_ADMIN" && conversation.type !== "PROPERTY_SUPPORT") {
    throw new ApiError(404, "ไม่พบบทสนทนา");
  }
}

export async function ensureTenantConversation(input: {
  propertyId: string;
  tenantProfileId: string;
  tenantName: string;
  roomNumber: string;
}) {
  // คีย์ที่ประกอบขึ้นเอง ใช้คู่กับ propertyId เป็นตัวระบุห้องสนทนา ผู้เช่าหนึ่งคนต่อหนึ่งหอมีห้องเดียว
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

export async function ensureSupportConversation(propertyId: string) {
  return getDatabase().chatConversation.upsert({
    where: { propertyId_conversationKey: { propertyId, conversationKey: "PROPERTY_SUPPORT" } },
    create: { propertyId, type: "PROPERTY_SUPPORT", conversationKey: "PROPERTY_SUPPORT" },
    update: {},
    select: { id: true },
  });
}

export async function listConversations(
  actor: ConversationActor,
  type: ChatConversationType,
  pagination: PaginationInput,
) {
  if (actor.role === "TENANT" && type !== "TENANT_PROPERTY") throw new ApiError(403, "คุณไม่มีสิทธิ์ดำเนินการ");
  if (actor.role === "SUPER_ADMIN" && type !== "PROPERTY_SUPPORT") throw new ApiError(403, "คุณไม่มีสิทธิ์ดำเนินการ");
  const readField = readFieldFor(actor.role);
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

// ส่งข้อความ ทำใน transaction เพราะต้องสร้างข้อความและอัปเดตเวลาข้อความล่าสุดไปด้วยกัน
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
    // clientId ที่ฝั่งเบราว์เซอร์สร้าง ใช้กันบันทึกซ้ำ ส่งคำขอเดิมมาอีกรอบจะได้ข้อความเดิมกลับไป
    // จำเป็นเพราะเน็ตหลุดแล้วกดส่งใหม่ ไม่ควรกลายเป็นสองข้อความ
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

export async function markConversationRead(conversationId: string, actor: ConversationActor) {
  const conversation = await getDatabase().chatConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, propertyId: true, type: true, tenantProfileId: true },
  });
  if (!conversation) throw new ApiError(404, "ไม่พบบทสนทนา");
  assertConversationAccess(conversation, actor);
  // แต่ละฝ่ายมีเวลาที่อ่านล่าสุดของตัวเอง จำนวนที่ยังไม่ได้อ่านจึงคิดแยกกันได้
  const field = readFieldFor(actor.role);
  await getDatabase().chatConversation.update({
    where: { id: conversation.id },
    data: { [field]: new Date() },
  });
}

// ตรวจสิทธิ์ก่อนคืนที่อยู่ไฟล์ ผู้เรียกจึงจะเอาไปอ่านไฟล์ได้
// ตรวจจากห้องสนทนาที่ข้อความนั้นอยู่ ไม่ใช่เชื่อ id ที่ส่งมา
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
  // ข้อความที่ไม่มีไฟล์แนบก็ตอบว่าไม่พบ ข้อความเดียวกับตอนไม่มีสิทธิ์ ไม่แยกให้เดาได้
  if (!message.attachmentKey || !message.attachmentMime || !message.attachmentName) {
    throw new ApiError(404, "ไม่พบไฟล์");
  }
  return {
    attachmentKey: message.attachmentKey,
    attachmentMime: message.attachmentMime,
    attachmentName: message.attachmentName,
  };
}
