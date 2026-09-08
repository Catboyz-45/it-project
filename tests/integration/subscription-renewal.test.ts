/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “subscription renewal.test” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import {
  createSubscriptionOrder,
  createSubscriptionPayment,
  reviewSubscriptionPayment,
} from "@/lib/server/subscription-orders";
import {
  cleanupIntegrationFixture,
  createIntegrationFixture,
} from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>>;
let planId = "";

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  const plan = await getDatabase().saasPlan.create({
    data: {
      code: `RENEW_${fixture.suffix.toUpperCase()}`,
      name: "Renewal test",
      monthlyPrice: 990,
      yearlyPrice: 9900,
      maxProperties: 3,
      maxRooms: 100,
    },
  });
  planId = plan.id;
});

afterAll(async () => {
  if (fixture) {
    await cleanupIntegrationFixture({
      propertyIds: [fixture.property.id, fixture.otherProperty.id],
      userIds: [fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id],
    });
  }
  if (planId) await getDatabase().saasPlan.deleteMany({ where: { id: planId } });
  await getDatabase().$disconnect();
});

describe("subscription order, payment and renewal lifecycle", () => {
  it("activates a new order and renews from the existing expiry", async () => {
    const firstNow = new Date("2026-07-15T00:00:00.000Z");
    const firstOrder = await createSubscriptionOrder(
      fixture.property.id,
      fixture.owner.id,
      { planId, billingInterval: "MONTHLY" },
      firstNow,
    );
    expect(firstOrder).toMatchObject({ type: "NEW", status: "PENDING_PAYMENT", amount: "990" });

    const firstPayment = await createSubscriptionPayment({
      propertyId: fixture.property.id,
      orderId: firstOrder.id,
      submittedByUserId: fixture.owner.id,
      storageKey: "integration/subscription-first.png",
      mimeType: "image/png",
      sizeBytes: 128,
    }, firstNow);
    const firstApproval = await reviewSubscriptionPayment(
      firstPayment.id,
      fixture.superAdmin.id,
      { status: "APPROVED" },
      firstNow,
    );
    expect(firstApproval.expiresAt).toEqual(new Date("2026-08-15T00:00:00.000Z"));

    const renewalNow = new Date("2026-07-20T00:00:00.000Z");
    const renewalOrder = await createSubscriptionOrder(
      fixture.property.id,
      fixture.owner.id,
      { planId, billingInterval: "MONTHLY" },
      renewalNow,
    );
    expect(renewalOrder.type).toBe("RENEWAL");
    const renewalPayment = await createSubscriptionPayment({
      propertyId: fixture.property.id,
      orderId: renewalOrder.id,
      submittedByUserId: fixture.owner.id,
      storageKey: "integration/subscription-renewal.png",
      mimeType: "image/png",
      sizeBytes: 128,
    }, renewalNow);
    const renewal = await reviewSubscriptionPayment(
      renewalPayment.id,
      fixture.superAdmin.id,
      { status: "APPROVED" },
      renewalNow,
    );
    expect(renewal.startsAt).toEqual(new Date("2026-08-15T00:00:00.000Z"));
    expect(renewal.expiresAt).toEqual(new Date("2026-09-15T00:00:00.000Z"));
    await expect(reviewSubscriptionPayment(
      renewalPayment.id,
      fixture.superAdmin.id,
      { status: "APPROVED" },
      renewalNow,
    )).rejects.toMatchObject({ status: 409 });
  });

  it("returns a rejected payment order to payment pending without changing subscription", async () => {
    const now = new Date("2026-09-16T00:00:00.000Z");
    const before = await getDatabase().propertySubscription.findUniqueOrThrow({
      where: { propertyId: fixture.property.id },
    });
    const order = await createSubscriptionOrder(
      fixture.property.id,
      fixture.owner.id,
      { planId, billingInterval: "YEARLY" },
      now,
    );
    const payment = await createSubscriptionPayment({
      propertyId: fixture.property.id,
      orderId: order.id,
      submittedByUserId: fixture.owner.id,
      storageKey: "integration/subscription-rejected.pdf",
      mimeType: "application/pdf",
      sizeBytes: 256,
    }, now);
    await reviewSubscriptionPayment(
      payment.id,
      fixture.superAdmin.id,
      { status: "REJECTED", rejectionNote: "ยอดไม่ตรง" },
      now,
    );
    expect(await getDatabase().subscriptionOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    })).toEqual({ status: "PENDING_PAYMENT" });
    expect((await getDatabase().propertySubscription.findUniqueOrThrow({
      where: { propertyId: fixture.property.id },
    })).expiresAt).toEqual(before.expiresAt);
  });
});
