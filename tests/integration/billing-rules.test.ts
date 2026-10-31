import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import {
  cancelInvoice,
  generateBulkInvoices,
  generateInvoice,
  issueInvoice,
  preflightInvoices,
  recalculateOverdueInvoices,
} from "@/lib/server/invoices";
import { recordMeterReading } from "@/lib/server/meters";
import { createPaymentSubmission } from "@/lib/server/payments";
import { createRoom, updateRoom } from "@/lib/server/property-structure";
import { createWorkspaceFixture } from "./helpers";

// กฎทางธุรกิจของบิลและห้องที่เส้นทางปกติไม่ได้เดินผ่าน ทดสอบที่ชั้น service โดยตรง
// เน้นกรณีที่ต้องปฏิเสธ ห้องที่ยังไม่พร้อม บิลที่ไม่อยู่ในสถานะที่ทำรายการได้ และค่าปรับล่าช้า

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
const month = "2026-05";

async function recordBothMeters(roomId: string, billingMonth: string) {
  for (const type of ["WATER", "ELECTRICITY"] as const) {
    await recordMeterReading(w.property.id, w.owner.id, { roomId, type, billingMonth, previousReading: 0, currentReading: 10 });
  }
}

beforeAll(async () => {
  w = await createWorkspaceFixture("BILLING_RULES");
}, 60_000);

afterAll(async () => {
  if (!w) return;
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("invoice preflight and bulk generation", () => {
  it("explains why a room cannot be billed yet and refuses an unknown room", async () => {
    const check = await preflightInvoices(w.property.id, { billingMonth: month });
    // ยังไม่จดมิเตอร์ ห้องนี้จึงติดอยู่พร้อมเหตุผล
    expect(check.blocked.map((row) => row.roomId)).toContain(w.room.id);
    expect(check.ready).toHaveLength(0);
    await expect(preflightInvoices(w.property.id, { billingMonth: month, roomId: w.otherProperty.id })).rejects.toMatchObject({ status: 404 });
  });

  it("lists the room as ready once the meters are in, and bulk generation skips nothing", async () => {
    await recordBothMeters(w.room.id, month);
    const check = await preflightInvoices(w.property.id, { billingMonth: month, roomId: w.room.id });
    expect(check.ready[0]).toMatchObject({ roomId: w.room.id, tenantName: "BILLING_RULES Tenant" });
    expect(check.ready[0].items.map((item) => item.type)).toEqual(expect.arrayContaining(["RENT", "WATER", "ELECTRICITY"]));

    const bulk = await generateBulkInvoices(w.property.id, { billingMonth: month, issueImmediately: false });
    expect(bulk.created).toHaveLength(1);
    // รอบที่สองห้องเดิมมีบิลแล้ว จึงถูกข้ามพร้อมเหตุผล ไม่ใช่ล้มทั้งชุด
    const again = await generateBulkInvoices(w.property.id, { billingMonth: month, issueImmediately: false });
    expect(again.created).toHaveLength(0);
    expect(again.skipped[0]).toMatchObject({ roomId: w.room.id });
  });
});

describe("issuing and cancelling", () => {
  it("issues only drafts", async () => {
    const draft = await getDatabase().invoice.findFirstOrThrow({ where: { propertyId: w.property.id, status: "DRAFT" }, select: { id: true, version: true } });
    await expect(issueInvoice(w.property.id, w.otherProperty.id, 1)).rejects.toMatchObject({ status: 404 });
    const issued = await issueInvoice(w.property.id, draft.id, draft.version);
    await expect(issueInvoice(w.property.id, draft.id, issued.version)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to cancel with a stale version, with a slip waiting, after payment, or twice", async () => {
    const invoice = await getDatabase().invoice.findFirstOrThrow({ where: { propertyId: w.property.id, status: "PENDING" }, select: { id: true, version: true } });
    await expect(cancelInvoice(w.property.id, w.otherProperty.id, 1, "ไม่มีบิลนี้")).rejects.toMatchObject({ status: 404 });
    await expect(cancelInvoice(w.property.id, invoice.id, invoice.version + 1, "เวอร์ชันเก่า")).rejects.toMatchObject({ status: 409 });

    // ผู้เช่าส่งสลิปแล้ว ยกเลิกไม่ได้จนกว่าจะตรวจสลิปเสร็จ
    const slip = await createPaymentSubmission({
      tenantProfileId: w.tenantProfileId, invoiceId: invoice.id, storageKey: "payment-slips/test/rules.png", mimeType: "image/png", size: 10,
    });
    await expect(cancelInvoice(w.property.id, invoice.id, invoice.version, "มีสลิปค้าง")).rejects.toMatchObject({ status: 409 });
    await getDatabase().paymentSubmission.update({ where: { id: slip.id }, data: { status: "REJECTED", reviewedAt: new Date(), rejectionNote: "ทดสอบ" } });

    const cancelled = await cancelInvoice(w.property.id, invoice.id, invoice.version, "ออกบิลซ้ำ");
    expect(cancelled.status).toBe("CANCELLED");
    await expect(cancelInvoice(w.property.id, invoice.id, cancelled.version, "ซ้ำอีก")).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to cancel a paid invoice", async () => {
    await recordBothMeters(w.room.id, "2026-06");
    const draft = await generateInvoice(w.property.id, { roomId: w.room.id, billingMonth: "2026-06", issueImmediately: false });
    const issued = await issueInvoice(w.property.id, draft.id, draft.version);
    await getDatabase().invoice.update({ where: { id: issued.id }, data: { status: "PAID", paidAt: new Date() } });
    await expect(cancelInvoice(w.property.id, issued.id, issued.version, "จ่ายแล้ว")).rejects.toMatchObject({ status: 409 });
  });
});

describe("late fees", () => {
  it("adds one late-fee line, updates it on later runs, and caps the amount", async () => {
    await recordBothMeters(w.room.id, "2026-07");
    const draft = await generateInvoice(w.property.id, { roomId: w.room.id, billingMonth: "2026-07", issueImmediately: false });
    const issued = await issueInvoice(w.property.id, draft.id, draft.version);
    const dueDate = (await getDatabase().invoice.findUniqueOrThrow({ where: { id: issued.id }, select: { dueDate: true } })).dueDate;
    const daysAfterDue = (days: number) => new Date(dueDate.getTime() + days * 86_400_000);

    await recalculateOverdueInvoices(w.property.id, daysAfterDue(3));
    const first = await getDatabase().invoice.findUniqueOrThrow({ where: { id: issued.id }, select: { status: true, lateFee: true, items: { where: { type: "LATE_FEE" } } } });
    expect(first.status).toBe("OVERDUE");
    expect(first.items).toHaveLength(1);
    const feeAfterThreeDays = Number(first.lateFee);
    expect(feeAfterThreeDays).toBeGreaterThan(0);

    // รันซ้ำนานขึ้น แก้รายการเดิม ไม่สร้างซ้อน และไม่เกินเพดานที่ตั้งไว้ (200 บาทใน fixture)
    await recalculateOverdueInvoices(w.property.id, daysAfterDue(60));
    const later = await getDatabase().invoice.findUniqueOrThrow({ where: { id: issued.id }, select: { lateFee: true, items: { where: { type: "LATE_FEE" } } } });
    expect(later.items).toHaveLength(1);
    expect(Number(later.lateFee)).toBe(200);

    // ตั้งค่าปรับเป็นศูนย์ รายการค่าปรับต้องหายไป
    await getDatabase().propertySettings.update({ where: { propertyId: w.property.id }, data: { lateFeePerDay: 0 } });
    await recalculateOverdueInvoices(w.property.id, daysAfterDue(61));
    const waived = await getDatabase().invoice.findUniqueOrThrow({ where: { id: issued.id }, select: { lateFee: true, items: { where: { type: "LATE_FEE" } } } });
    expect(waived.items).toHaveLength(0);
    expect(Number(waived.lateFee)).toBe(0);
  });
});

describe("room rules", () => {
  it("refuses a status change while someone lives in the room, and a floor from another building", async () => {
    await expect(updateRoom(w.property.id, w.room.id, { status: "MAINTENANCE" })).rejects.toMatchObject({ status: 409 });
    const otherBuilding = await getDatabase().building.create({
      data: { propertyId: w.property.id, name: "อาคารอื่น", code: `OB-${w.suffix}`, floors: { create: { propertyId: w.property.id, number: 1 } } },
      include: { floors: true },
    });
    await expect(updateRoom(w.property.id, w.room.id, { floorId: otherBuilding.floors[0].id })).rejects.toMatchObject({ status: 400 });
    await expect(updateRoom(w.property.id, w.otherProperty.id, { roomType: "x" })).rejects.toMatchObject({ status: 404 });
  });

  it("reuses existing furniture names and creates new ones once", async () => {
    const updated = await updateRoom(w.property.id, w.room.id, { furniture: ["ตู้เสื้อผ้า", "ตู้เสื้อผ้า ", "โต๊ะ"] });
    expect(updated.furniture.sort()).toEqual(["ตู้เสื้อผ้า", "โต๊ะ"].sort());
    const again = await updateRoom(w.property.id, w.room.id, { furniture: ["โต๊ะ"] });
    expect(again.furniture).toEqual(["โต๊ะ"]);
    expect(await getDatabase().furnitureOption.count({ where: { propertyId: w.property.id, name: "โต๊ะ" } })).toBe(1);
  });

  it("stops creating rooms at the plan's room limit", async () => {
    await getDatabase().propertySubscription.update({ where: { propertyId: w.property.id }, data: { maxRooms: 1 } });
    await expect(createRoom(w.property.id, {
      buildingId: w.building.id, floorId: w.floor.id, number: `LIMIT-${w.suffix}`, roomType: "Standard",
      monthlyRent: 1000, depositAmount: 0, capacity: 1, furniture: [],
    })).rejects.toMatchObject({ status: 409 });
  });
});

describe("payment slips", () => {
  // บิลยอดศูนย์ต้องได้ข้อความที่อธิบายได้ ไม่ใช่ข้อผิดพลาดของระบบจากข้อจำกัดในฐานข้อมูล
  it("refuses a slip for an invoice with nothing to pay", async () => {
    await recordBothMeters(w.room.id, "2026-12");
    const draft = await generateInvoice(w.property.id, { roomId: w.room.id, billingMonth: "2026-12", issueImmediately: false });
    const issued = await issueInvoice(w.property.id, draft.id, draft.version);
    await getDatabase().invoice.update({ where: { id: issued.id }, data: { subtotal: 0, total: 0 } });
    await expect(createPaymentSubmission({
      tenantProfileId: w.tenantProfileId, invoiceId: issued.id, storageKey: "payment-slips/test/zero.png", mimeType: "image/png", size: 10,
    })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("ไม่มียอดที่ต้องชำระ") });
    await getDatabase().invoice.update({ where: { id: issued.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  });
});
