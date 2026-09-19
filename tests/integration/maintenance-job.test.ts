import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { runMaintenanceJob } from "@/lib/server/maintenance-job";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let planId = "";

// เตรียมสถานการณ์ให้ครบสามอย่างที่งานเบื้องหลังต้องจัดการ บิลเกินกำหนด ประกาศตั้งเวลา และแพ็กเกจหมดอายุ
beforeAll(async () => {
  fixture = await createIntegrationFixture();
  const plan = await getDatabase().saasPlan.create({
    data: {
      code: `JOB_${fixture.suffix.toUpperCase()}`, name: "Maintenance Test",
      monthlyPrice: 100, maxProperties: 1, maxRooms: 10,
    },
  });
  planId = plan.id;
  await getDatabase().propertySubscription.create({
    data: {
      propertyId: fixture.property.id, planId: plan.id, planName: plan.name,
      priceAmount: 100, status: "ACTIVE", maxProperties: 1, maxRooms: 10,
      // ตั้งวันที่ไว้ปี 2000 เพื่อไม่ให้ชนกับข้อมูลเดโมหรือข้อมูล E2E ที่อาจอยู่ในฐานเดียวกัน
      startsAt: new Date("2000-01-01T00:00:00.000Z"),
      expiresAt: new Date("2000-07-01T00:00:00.000Z"),
    },
  });
  await getDatabase().invoice.create({
    data: {
      propertyId: fixture.property.id, roomId: fixture.room.id,
      invoiceNumber: `JOB-${fixture.suffix}`, billingMonth: new Date("2000-06-01T00:00:00.000Z"),
      // ครบกำหนดวันที่ 5 มิ.ย. ส่วนงานจะรันวันที่ 10 ก.ค. จึงเกินมา 35 วัน
      status: "PENDING", dueDate: new Date("2000-06-05T00:00:00.000Z"),
      subtotal: 1000, total: 1000,
    },
  });
  // ประกาศที่ตั้งเวลาไว้ก่อนวันรันงาน ต้องถูกเผยแพร่อัตโนมัติ
  await getDatabase().announcement.create({
    data: {
      propertyId: fixture.property.id, title: "Scheduled", content: "Publish me",
      audience: "ALL_TENANTS", status: "SCHEDULED",
      publishAt: new Date("2000-07-01T08:00:00.000Z"), createdById: fixture.owner.id,
    },
  });
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id],
  });
  if (planId) await getDatabase().saasPlan.deleteMany({ where: { id: planId } });
  await getDatabase().$disconnect();
});

describe("maintenance background job integration", () => {
  // งานเบื้องหลังทำสามอย่างใน transaction เดียว เทสต์นี้เช็คทั้งสามพร้อมกัน
  it("updates overdue invoices, scheduled announcements and expired subscriptions atomically", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    // ใช้ช่วงเวลาปี 2000 ที่ไม่ทับกับข้อมูลเดโมหรือ E2E ที่อาจอยู่ในฐานทดสอบเดียวกัน
    const runAt = new Date("2000-07-10T00:00:00.000Z");
    const result = await runMaintenanceJob(runAt);
    expect(result).toMatchObject({
      status: "completed",
      overdueInvoices: 1,
      publishedAnnouncements: 1,
      expiredSubscriptions: 1,
    });

    const [invoice, announcement, subscription] = await Promise.all([
      getDatabase().invoice.findFirstOrThrow({ where: { propertyId: fixture.property.id }, include: { items: true } }),
      getDatabase().announcement.findFirstOrThrow({ where: { propertyId: fixture.property.id } }),
      getDatabase().propertySubscription.findUniqueOrThrow({ where: { propertyId: fixture.property.id } }),
    ]);
    expect(invoice.status).toBe("OVERDUE");
    // เทียบเป็นสตริงเพราะ Prisma คืน Decimal มา แปลงเป็น number ตรง ๆ จะปัดเศษเพี้ยน
    expect(invoice.lateFee.toString()).toBe("200");
    // ค่าปรับต้องมีบรรทัดเดียว ไม่ใช่เพิ่มใหม่ทุกครั้งที่งานรัน
    expect(invoice.items.filter((item) => item.type === "LATE_FEE")).toHaveLength(1);
    expect(announcement).toMatchObject({ status: "PUBLISHED", publishedAt: runAt });
    expect(subscription.status).toBe("EXPIRED");

    // รันซ้ำด้วยเวลาเดิม ต้องไม่ทำอะไรเพิ่ม เพราะงานตั้งเวลาอาจถูกเรียกซ้ำได้เสมอ
    const rerun = await runMaintenanceJob(runAt);
    expect(rerun).toMatchObject({ status: "completed", publishedAnnouncements: 0, expiredSubscriptions: 0 });
    expect(await getDatabase().invoiceItem.count({
      where: { invoiceId: invoice.id, type: "LATE_FEE" },
    })).toBe(1);
  });
});
