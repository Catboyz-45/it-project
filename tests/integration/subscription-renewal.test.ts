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

// เตรียมหอกับแพ็กเกจให้ครบก่อน เทสต์ในไฟล์นี้ต่อยอดกันเป็นลำดับ
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
  // ต่ออายุต้องนับต่อจากวันหมดอายุเดิม ไม่ใช่นับจากวันที่จ่าย ไม่งั้นผู้ใช้เสียวันที่เหลือไปฟรี ๆ
  it("activates a new order and renews from the existing expiry", async () => {
    // ส่งเวลาเข้าไปเองแทนการใช้เวลาจริง ผลลัพธ์จะได้เป็นวันที่ตายตัวที่เช็คได้
    const firstNow = new Date("2026-07-15T00:00:00.000Z");
    const firstOrder = await createSubscriptionOrder(
      fixture.property.id,
      fixture.owner.id,
      { planId, billingInterval: "MONTHLY" },
      firstNow,
    );
    // ยังไม่เคยมีแพ็กเกจจึงเป็น NEW และยอดเป็นสตริงเพราะเป็น Decimal จากฐานข้อมูล
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
    // สมัครใหม่นับจากวันที่อนุมัติ 15 ก.ค. บวกหนึ่งเดือนเป็น 15 ส.ค.
    expect(firstApproval.expiresAt).toEqual(new Date("2026-08-15T00:00:00.000Z"));

    // ต่ออายุตั้งแต่วันที่ 20 ก.ค. ทั้งที่ของเดิมยังไม่หมด เป็นกรณีที่คนต่อล่วงหน้า
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
    // รอบใหม่เริ่มวันที่ของเดิมหมด ไม่ใช่วันที่ 20 ก.ค. ที่จ่าย จึงไม่เสียวันที่เหลืออยู่
    expect(renewal.startsAt).toEqual(new Date("2026-08-15T00:00:00.000Z"));
    expect(renewal.expiresAt).toEqual(new Date("2026-09-15T00:00:00.000Z"));
    // อนุมัติใบเดิมซ้ำต้องได้ 409 ไม่ใช่ต่ออายุให้อีกรอบ กันแอดมินเผลอกดสองครั้ง
    await expect(reviewSubscriptionPayment(
      renewalPayment.id,
      fixture.superAdmin.id,
      { status: "APPROVED" },
      renewalNow,
    )).rejects.toMatchObject({ status: 409 });
  });

  // ปฏิเสธหลักฐานแล้วคำสั่งซื้อต้องกลับไปรอจ่ายใหม่ และแพ็กเกจเดิมต้องไม่ถูกแตะ
  it("returns a rejected payment order to payment pending without changing subscription", async () => {
    const now = new Date("2026-09-16T00:00:00.000Z");
    // จำวันหมดอายุเดิมไว้ก่อน ไว้เทียบตอนจบว่าไม่ถูกเปลี่ยน
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
    // กลับไปสถานะรอชำระ ผู้ใช้จึงส่งหลักฐานใหม่ได้โดยไม่ต้องสั่งซื้อใหม่ทั้งใบ
    expect(await getDatabase().subscriptionOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    })).toEqual({ status: "PENDING_PAYMENT" });
    expect((await getDatabase().propertySubscription.findUniqueOrThrow({
      where: { propertyId: fixture.property.id },
    })).expiresAt).toEqual(before.expiresAt);
  });
});
