/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “maintenance job.test” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { runMaintenanceJob } from "@/lib/server/maintenance-job";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let planId = "";

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
      startsAt: new Date("2000-01-01T00:00:00.000Z"),
      expiresAt: new Date("2000-07-01T00:00:00.000Z"),
    },
  });
  await getDatabase().invoice.create({
    data: {
      propertyId: fixture.property.id, roomId: fixture.room.id,
      invoiceNumber: `JOB-${fixture.suffix}`, billingMonth: new Date("2000-06-01T00:00:00.000Z"),
      status: "PENDING", dueDate: new Date("2000-06-05T00:00:00.000Z"),
      subtotal: 1000, total: 1000,
    },
  });
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
  it("updates overdue invoices, scheduled announcements and expired subscriptions atomically", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    // Keep this window isolated from demo/E2E records that may coexist in the
    // dedicated test database during local development.
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
    expect(invoice.lateFee.toString()).toBe("200");
    expect(invoice.items.filter((item) => item.type === "LATE_FEE")).toHaveLength(1);
    expect(announcement).toMatchObject({ status: "PUBLISHED", publishedAt: runAt });
    expect(subscription.status).toBe("EXPIRED");

    const rerun = await runMaintenanceJob(runAt);
    expect(rerun).toMatchObject({ status: "completed", publishedAnnouncements: 0, expiredSubscriptions: 0 });
    expect(await getDatabase().invoiceItem.count({
      where: { invoiceId: invoice.id, type: "LATE_FEE" },
    })).toBe(1);
  });
});
