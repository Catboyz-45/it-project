import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { createAnnouncement, updateAnnouncement, updateTicket } from "@/lib/server/property-operations";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;

beforeAll(async () => {
  fixture = await createIntegrationFixture();
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id],
  });
  await getDatabase().$disconnect();
});

// สร้างเรื่องแจ้งซ่อมหนึ่งรายการไว้ให้แต่ละเทสต์แก้ ไม่ใช้ร่วมกันเพราะแต่ละเทสต์เปลี่ยนสถานะมัน
async function createTicket(status: "OPEN" | "RESOLVED" = "OPEN") {
  if (!fixture) throw new Error("Fixture was not initialized");
  return getDatabase().serviceTicket.create({
    data: {
      propertyId: fixture.property.id,
      roomId: fixture.room.id,
      type: "REPAIR",
      title: "ไฟห้องน้ำเสีย",
      detail: "หลอดไฟกะพริบตลอดเวลา",
      priority: "NORMAL",
      status,
      createdByUserId: fixture.owner.id,
    },
    select: { id: true, updatedAt: true },
  });
}

// การแก้ชนกันคือสองคนเปิดหน้าเดียวกันแล้วกดบันทึกไล่หลังกัน คนที่สองต้องไม่ทับงานคนแรกเงียบ ๆ
describe("edit conflict and state guards", () => {
  it("rejects a ticket edit that was based on a stale copy", async () => {
    const ticket = await createTicket();
    // จำลองว่ามีคนอื่นบันทึกไปก่อนแล้ว เวลาที่เราถืออยู่จึงเก่ากว่าของจริง
    const stale = new Date(ticket.updatedAt.getTime() - 1_000);

    await expect(updateTicket(fixture!.property.id, ticket.id, fixture!.owner.id, {
      title: "ไฟห้องน้ำเสีย (แก้ไข)",
      expectedUpdatedAt: stale,
    })).rejects.toMatchObject({ status: 409 });

    // ของเดิมต้องไม่ถูกแตะ ไม่ใช่แก้ไปครึ่งหนึ่งแล้วค่อยโยน error
    const after = await getDatabase().serviceTicket.findUnique({ where: { id: ticket.id }, select: { title: true } });
    expect(after?.title).toBe("ไฟห้องน้ำเสีย");
  });

  it("accepts the same edit when the expected time matches", async () => {
    const ticket = await createTicket();
    await expect(updateTicket(fixture!.property.id, ticket.id, fixture!.owner.id, {
      title: "ไฟห้องน้ำเสีย (แก้ไข)",
      expectedUpdatedAt: ticket.updatedAt,
    })).resolves.toBeDefined();
  });

  // เรื่องที่ปิดแล้วต้องคงเนื้อหาไว้เป็นหลักฐาน แก้ได้แค่สถานะ
  it("refuses to change the content of a closed ticket", async () => {
    const ticket = await createTicket("RESOLVED");
    for (const change of [{ title: "เปลี่ยนหัวเรื่อง" }, { detail: "เปลี่ยนรายละเอียด" }, { priority: "URGENT" as const }]) {
      await expect(updateTicket(fixture!.property.id, ticket.id, fixture!.owner.id, change))
        .rejects.toMatchObject({ status: 409 });
    }
  });

  // ตารางสถานะบอกว่าจากไหนไปไหนได้บ้าง ข้ามขั้นไม่ได้ เช่น OPEN ไป RESOLVED ตรง ๆ
  it("blocks a status jump that the transition table does not allow", async () => {
    const ticket = await createTicket();
    await expect(updateTicket(fixture!.property.id, ticket.id, fixture!.owner.id, { status: "RESOLVED" }))
      .rejects.toMatchObject({ status: 409 });

    // เส้นทางที่อนุญาตต้องผ่าน เพื่อยืนยันว่าไม่ได้บล็อกทุกอย่างทิ้ง
    await expect(updateTicket(fixture!.property.id, ticket.id, fixture!.owner.id, { status: "ACKNOWLEDGED" }))
      .resolves.toBeDefined();
  });

  it("rejects an announcement edit that was based on a stale copy", async () => {
    const announcement = await createAnnouncement(fixture!.property.id, fixture!.owner.id, {
      title: "แจ้งปิดน้ำ",
      content: "ปิดน้ำวันเสาร์ 9 โมงถึงเที่ยง",
      audience: "ALL_TENANTS",
      status: "PUBLISHED",
      roomIds: [],
    });
    const stale = new Date(announcement.updatedAt.getTime() - 1_000);

    await expect(updateAnnouncement(fixture!.property.id, announcement.id, {
      title: "แจ้งปิดน้ำ (แก้ไข)",
      expectedUpdatedAt: stale,
    })).rejects.toMatchObject({ status: 409 });

    await expect(updateAnnouncement(fixture!.property.id, announcement.id, {
      title: "แจ้งปิดน้ำ (แก้ไข)",
      expectedUpdatedAt: announcement.updatedAt,
    })).resolves.toBeDefined();
  });

  // ประกาศของหออื่นต้องหาไม่เจอ ไม่ใช่แก้ได้แล้วค่อยไปเช็คสิทธิ์ทีหลัง
  it("cannot reach an announcement that belongs to another property", async () => {
    const announcement = await createAnnouncement(fixture!.property.id, fixture!.owner.id, {
      title: "เฉพาะหอนี้",
      content: "ข้อความภายใน",
      audience: "ALL_TENANTS",
      status: "DRAFT",
      roomIds: [],
    });

    await expect(updateAnnouncement(fixture!.otherProperty.id, announcement.id, {
      title: "แอบแก้ข้ามหอ",
      expectedUpdatedAt: announcement.updatedAt,
    })).rejects.toBeInstanceOf(ApiError);
  });
});
