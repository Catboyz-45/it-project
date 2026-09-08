/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “saas dashboard.test” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { assignPropertySubscription, createSaasPlan } from "@/lib/server/saas";
import { getOwnerDashboardAggregation, getSuperAdminDashboardAggregation } from "@/lib/server/dashboard-aggregation";

const suffix = randomUUID().slice(0, 8);
let propertyId = "";
let planId = "";

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!/test/i.test(url.pathname)) throw new Error("Integration tests require a dedicated database whose name contains 'test'");
  const property = await getDatabase().property.create({
    data: { name: `Integration ${suffix}`, shortName: `IT-${suffix}` },
    select: { id: true },
  });
  propertyId = property.id;
  const plan = await createSaasPlan({
    code: `IT_${suffix.toUpperCase()}`,
    name: `Integration ${suffix}`,
    monthlyPrice: 500,
    yearlyPrice: 5000,
    maxProperties: 2,
    maxRooms: 10,
    allowPromptPay: true,
    allowFileUploads: true,
    allowPrioritySupport: false,
    sortOrder: 9999,
    description: "integration test",
  });
  planId = plan.id;
});

afterAll(async () => {
  if (propertyId) await getDatabase().property.deleteMany({ where: { id: propertyId } });
  if (planId) await getDatabase().saasPlan.deleteMany({ where: { id: planId } });
  await getDatabase().$disconnect();
});

describe("SaaS subscription and dashboard integration", () => {
  it("assigns a plan and exposes its utilization", async () => {
    const startsAt = new Date();
    const subscription = await assignPropertySubscription(propertyId, {
      planId, status: "ACTIVE", billingInterval: "MONTHLY", startsAt,
      expiresAt: new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    });
    expect(subscription.planId).toBe(planId);
    expect(subscription.maxRooms).toBe(10);
    const dashboard = await getOwnerDashboardAggregation(propertyId);
    expect(dashboard?.subscription?.usedRooms).toBe(0);
    expect(dashboard?.subscription?.roomUsagePercent).toBe(0);
  });

  it("includes the subscription in platform aggregation", async () => {
    const dashboard = await getSuperAdminDashboardAggregation();
    expect(dashboard.subscriptions.active).toBeGreaterThanOrEqual(1);
    expect(dashboard.revenue.mrr).toBeGreaterThanOrEqual(500);
  });
});
