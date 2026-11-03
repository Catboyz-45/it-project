import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { createTenantTicket, createTicketReply, listTicketInbox, listTicketReplies, updateTicket } from "@/lib/server/property-operations";
import { createWorkspaceFixture } from "./helpers";

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
const pagination = { page: 1, pageSize: 50 };

beforeAll(async () => {
  w = await createWorkspaceFixture("TICKET_INBOX");
});

afterAll(async () => {
  await w.cleanup();
  await getDatabase().$disconnect();
});

function newTicket(isAnonymous: boolean, title: string) {
  return createTenantTicket({
    propertyId: w.property.id,
    roomId: w.room.id,
    tenantProfileId: w.tenantProfileId,
    userId: w.tenantUserId,
    data: { type: isAnonymous ? "COMPLAINT" : "REPAIR", title, detail: `รายละเอียด ${title}`, priority: "NORMAL", isAnonymous },
  });
}

// กล่องข้อความรวมของแชทเล็ก เรื่องแจ้งต้องขึ้นพร้อมข้อความล่าสุด ป้ายยังไม่อ่าน และเส้นเวลาสถานะ
describe("ticket inbox", () => {
  it("shows the latest reply, unread state and status changes for each side", async () => {
    const ticket = await newTicket(false, "แอร์ไม่เย็น");
    await createTicketReply({ ticketId: ticket.id, actorUserId: w.tenantUserId, tenantProfileId: w.tenantProfileId, data: { body: "ช่างเข้าได้กี่โมงครับ" } });
    await updateTicket(w.property.id, ticket.id, w.owner.id, { status: "ACKNOWLEDGED" });

    const ownerInbox = await listTicketInbox({ viewerUserId: w.owner.id, propertyId: w.property.id });
    const ownerItem = ownerInbox.find((item) => item.id === ticket.id);
    expect(ownerItem).toMatchObject({
      roomNumber: w.room.number,
      tenantName: "TICKET_INBOX Tenant",
      hasUnread: true,
      lastMessage: { body: "ช่างเข้าได้กี่โมงครับ", fromSelf: false },
    });
    expect(ownerItem?.statusEvents.map((event) => event.toValue)).toEqual(["ACKNOWLEDGED"]);

    // เปิดอ่านแล้วป้ายยังไม่อ่านต้องหาย
    await listTicketReplies({ ticketId: ticket.id, propertyId: w.property.id, viewerUserId: w.owner.id, pagination });
    const afterRead = await listTicketInbox({ viewerUserId: w.owner.id, propertyId: w.property.id });
    expect(afterRead.find((item) => item.id === ticket.id)?.hasUnread).toBe(false);

    const tenantInbox = await listTicketInbox({ viewerUserId: w.tenantUserId, propertyId: w.property.id, tenantProfileId: w.tenantProfileId });
    expect(tenantInbox.find((item) => item.id === ticket.id)).toMatchObject({ hasUnread: false, lastMessage: { fromSelf: true } });
  });

  // ร้องเรียนแบบไม่ระบุชื่อ ฝั่งหอต้องไม่รู้ว่าใครแจ้ง ทั้งในรายการและในข้อความที่ผู้แจ้งตอบมา
  it("keeps anonymous complaints anonymous for the owner", async () => {
    const ticket = await newTicket(true, "เสียงดังหลังสี่ทุ่ม");
    await createTicketReply({ ticketId: ticket.id, actorUserId: w.tenantUserId, tenantProfileId: w.tenantProfileId, data: { body: "ยังดังอยู่เลย" } });

    const ownerItem = (await listTicketInbox({ viewerUserId: w.owner.id, propertyId: w.property.id })).find((item) => item.id === ticket.id);
    expect(ownerItem).toMatchObject({ isAnonymous: true, roomNumber: null, tenantName: null });

    const ownerReplies = await listTicketReplies({ ticketId: ticket.id, propertyId: w.property.id, viewerUserId: w.owner.id, pagination });
    expect(ownerReplies.data[0].authorUser).toMatchObject({ id: "anonymous", displayName: "ผู้แจ้งไม่ระบุชื่อ" });

    // ผู้แจ้งเองยังเห็นข้อความของตัวเองตามปกติ
    const tenantReplies = await listTicketReplies({ ticketId: ticket.id, tenantProfileId: w.tenantProfileId, viewerUserId: w.tenantUserId, pagination });
    expect(tenantReplies.data[0].authorUser?.id).toBe(w.tenantUserId);
  });

  // ผู้เช่าเห็นเฉพาะเรื่องของตัวเอง เรื่องที่ขอให้ติดมาด้วยต้องอยู่ในหอเดียวกันเท่านั้น
  it("never lists another property's ticket even when asked for it", async () => {
    const otherTicket = await getDatabase().serviceTicket.create({
      data: { propertyId: w.otherProperty.id, type: "REPAIR", title: "หออื่น", detail: "ไม่ควรเห็น" },
      select: { id: true },
    });
    const ownerInbox = await listTicketInbox({ viewerUserId: w.owner.id, propertyId: w.property.id, includeTicketId: otherTicket.id });
    expect(ownerInbox.some((item) => item.id === otherTicket.id)).toBe(false);
  });

  // เรื่องที่เสร็จแล้วผู้เช่าตอบไม่ได้ ต้องแจ้งเรื่องใหม่ แต่หอยังตามงานต่อได้ เรื่องที่ยกเลิกตอบไม่ได้ทั้งคู่
  it("closes replies on finished tickets for the tenant but not for the dorm", async () => {
    const ticket = await newTicket(false, "ประตูห้องน้ำปิดไม่สนิท");
    await updateTicket(w.property.id, ticket.id, w.owner.id, { status: "ACKNOWLEDGED" });
    await updateTicket(w.property.id, ticket.id, w.owner.id, { status: "RESOLVED" });
    await expect(createTicketReply({ ticketId: ticket.id, actorUserId: w.tenantUserId, tenantProfileId: w.tenantProfileId, data: { body: "ยังปิดไม่สนิท" } }))
      .rejects.toMatchObject({ status: 409 });
    await expect(createTicketReply({ ticketId: ticket.id, actorUserId: w.owner.id, propertyId: w.property.id, data: { body: "ช่างจะไปดูอีกรอบนะครับ" } }))
      .resolves.toMatchObject({ body: "ช่างจะไปดูอีกรอบนะครับ" });
  });
});
