import { randomUUID } from "node:crypto";
import type {
  CreateSubscriptionOrderInput,
  ReviewSubscriptionPaymentInput,
} from "@/lib/domain/saas";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

const orderSelect = {
  id: true, orderNumber: true, propertyId: true, planId: true, planCode: true,
  planName: true, type: true, status: true, billingInterval: true, amount: true,
  maxProperties: true, maxRooms: true, allowPromptPay: true,
  allowFileUploads: true, allowPrioritySupport: true, expiresAt: true,
  paidAt: true, activatedAt: true, cancelledAt: true, createdAt: true, updatedAt: true,
  payments: {
    orderBy: { submittedAt: "desc" as const },
    select: {
      id: true, amount: true, mimeType: true, sizeBytes: true, status: true,
      submittedAt: true, reviewedAt: true, rejectionNote: true,
    },
  },
} as const;

function serializeOrder<T extends { amount: { toString(): string }; payments: Array<{ amount: { toString(): string } }> }>(order: T) {
  return {
    ...order,
    amount: order.amount.toString(),
    payments: order.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })),
  };
}

export async function listPropertySubscriptionOrders(propertyId: string, pagination: PaginationInput) {
  const rows = await getDatabase().subscriptionOrder.findMany({
    where: { propertyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: orderSelect,
  });
  return toPaginatedResult(rows.map(serializeOrder), pagination);
}

// เจ้าของหอสั่งซื้อหรือต่ออายุแพ็กเกจเอง
export async function createSubscriptionOrder(
  propertyId: string,
  createdByUserId: string,
  input: CreateSubscriptionOrderInput,
  now = new Date(),
) {
  return getDatabase().$transaction(async (database) => {
    const property = await database.property.findUnique({
        where: { id: propertyId },
        select: { id: true, subscription: { select: { status: true, expiresAt: true } } },
      });
    const plan = await database.saasPlan.findFirst({ where: { id: input.planId, isActive: true } });
    const openOrder = await database.subscriptionOrder.findFirst({
        where: { propertyId, status: { in: ["PENDING_PAYMENT", "PENDING_REVIEW"] } },
        select: { id: true },
      });
    if (!property) throw new ApiError(404, "ไม่พบหอพัก");
    if (!plan) throw new ApiError(400, "แพ็กเกจไม่พร้อมใช้งาน");
    // มีคำสั่งซื้อค้างอยู่ก็สั่งใหม่ไม่ได้ กันสั่งซ้อนแล้วจ่ายซ้ำ
    if (openOrder) throw new ApiError(409, "หอนี้มีคำสั่งซื้อที่ยังดำเนินการไม่เสร็จ");
    const amount = input.billingInterval === "YEARLY"
      ? plan.yearlyPrice ?? plan.monthlyPrice.mul(12)
      : plan.monthlyPrice;
    const type = property.subscription ? "RENEWAL" : "NEW";
    try {
      const order = await database.subscriptionOrder.create({
        data: {
          orderNumber: `SUB-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
          propertyId, planId: plan.id, planCode: plan.code, planName: plan.name,
          type, billingInterval: input.billingInterval, amount,
          maxProperties: plan.maxProperties, maxRooms: plan.maxRooms,
          allowPromptPay: plan.allowPromptPay,
          allowFileUploads: plan.allowFileUploads,
          allowPrioritySupport: plan.allowPrioritySupport,
          createdByUserId,
          expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        },
        select: orderSelect,
      });
      return serializeOrder(order);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
      // ดักซ้ำจาก unique constraint ด้วย เผื่อกดพร้อมกันจนรอดการเช็คข้างบนมาได้
        throw new ApiError(409, "หอนี้มีคำสั่งซื้อที่ยังดำเนินการไม่เสร็จ");
      }
      throw error;
    }
  }, { isolationLevel: "Serializable" });
}

export async function createSubscriptionPayment(input: {
  propertyId: string;
  orderId: string;
  submittedByUserId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}, now = new Date()) {
  return getDatabase().$transaction(async (database) => {
    const order = await database.subscriptionOrder.findFirst({
      where: { id: input.orderId, propertyId: input.propertyId },
      select: { id: true, amount: true, status: true, expiresAt: true },
    });
    if (!order) throw new ApiError(404, "ไม่พบคำสั่งซื้อ");
    if (order.status !== "PENDING_PAYMENT") {
      throw new ApiError(409, "คำสั่งซื้อนี้ไม่สามารถส่งหลักฐานได้");
    }
    if (order.expiresAt <= now) {
      await database.subscriptionOrder.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
    // คำสั่งซื้อมีอายุ เลยกำหนดแล้วต้องสั่งใหม่ กันโอนตามราคาเก่าที่เปลี่ยนไปแล้ว
      throw new ApiError(409, "คำสั่งซื้อหมดอายุแล้ว");
    }
    const payment = await database.subscriptionPayment.create({
      data: {
        orderId: order.id, amount: order.amount, storageKey: input.storageKey,
        mimeType: input.mimeType, sizeBytes: input.sizeBytes,
        submittedByUserId: input.submittedByUserId,
      },
      select: {
        id: true, orderId: true, amount: true, status: true, mimeType: true,
        sizeBytes: true, submittedAt: true,
      },
    });
    await database.subscriptionOrder.update({
      where: { id: order.id },
      data: { status: "PENDING_REVIEW" },
    });
    return { ...payment, amount: payment.amount.toString() };
  }, { isolationLevel: "Serializable" });
}

export async function listPendingSubscriptionPayments(pagination: PaginationInput, query?: string) {
  const where = { status: "PENDING_REVIEW" as const, ...(query ? { order: { OR: [{ orderNumber: { contains: query, mode: "insensitive" as const } }, { planName: { contains: query, mode: "insensitive" as const } }, { property: { name: { contains: query, mode: "insensitive" as const } } }] } } : {}) };
  const [rows, total] = await getDatabase().$transaction([getDatabase().subscriptionPayment.findMany({
    where,
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, orderId: true, amount: true, mimeType: true, sizeBytes: true,
      status: true, submittedAt: true,
      order: {
        select: {
          orderNumber: true, propertyId: true, planName: true,
          billingInterval: true, type: true,
          property: { select: { name: true } },
        },
      },
    },
  }), getDatabase().subscriptionPayment.count({ where })]);
  return toPaginatedResult(rows.map((row) => ({ ...row, amount: row.amount.toString() })), pagination, total);
}

// คืนที่อยู่ไฟล์สลิปให้ผู้เรียกที่ตรวจสิทธิ์มาแล้ว ไม่ได้ตรวจสิทธิ์ซ้ำในนี้
export async function getSubscriptionPaymentSlip(paymentId: string) {
  const payment = await getDatabase().subscriptionPayment.findUnique({
    where: { id: paymentId },
    select: { storageKey: true, mimeType: true, order: { select: { orderNumber: true } } },
  });
  if (!payment) throw new ApiError(404, "ไม่พบหลักฐานการชำระ");
  return payment;
}

function addBillingPeriod(start: Date, interval: "MONTHLY" | "YEARLY") {
  const end = new Date(start);
  if (interval === "YEARLY") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

// ผู้ดูแลระบบตรวจหลักฐาน อนุมัติแล้วระบบเปิดใช้หรือต่ออายุแพ็กเกจให้อัตโนมัติ
export async function reviewSubscriptionPayment(
  paymentId: string,
  reviewedByUserId: string,
  input: ReviewSubscriptionPaymentInput,
  now = new Date(),
) {
  return getDatabase().$transaction(async (database) => {
    const payment = await database.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new ApiError(404, "ไม่พบหลักฐานการชำระ");
    if (payment.status !== "PENDING_REVIEW" || payment.order.status !== "PENDING_REVIEW") {
    // ตรวจไปแล้วก็ตรวจซ้ำไม่ได้ กันอนุมัติสองรอบแล้วต่ออายุซ้อนกัน
      throw new ApiError(409, "หลักฐานนี้ถูกตรวจสอบแล้ว");
    }
    if (input.status === "REJECTED") {
      await database.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: "REJECTED", reviewedAt: now, reviewedByUserId, rejectionNote: input.rejectionNote },
      });
      await database.subscriptionOrder.update({
        where: { id: payment.orderId },
        data: { status: "PENDING_PAYMENT" },
      });
      return { paymentId: payment.id, orderId: payment.orderId, status: "REJECTED" as const };
    }
    const current = await database.propertySubscription.findUnique({
      where: { propertyId: payment.order.propertyId },
      select: { status: true, expiresAt: true },
    });
    const startsAt = current && current.expiresAt > now ? current.expiresAt : now;
    const expiresAt = addBillingPeriod(startsAt, payment.order.billingInterval);
    await database.propertySubscription.upsert({
      where: { propertyId: payment.order.propertyId },
      create: {
        propertyId: payment.order.propertyId, planId: payment.order.planId,
        planName: payment.order.planName, billingInterval: payment.order.billingInterval,
        priceAmount: payment.order.amount, status: "ACTIVE",
        maxProperties: payment.order.maxProperties, maxRooms: payment.order.maxRooms,
        startsAt, expiresAt,
      },
      update: {
        planId: payment.order.planId, planName: payment.order.planName,
        billingInterval: payment.order.billingInterval, priceAmount: payment.order.amount,
        status: "ACTIVE", maxProperties: payment.order.maxProperties,
        maxRooms: payment.order.maxRooms, startsAt, expiresAt, suspendedAt: null,
      },
    });
    await database.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: "APPROVED", reviewedAt: now, reviewedByUserId, rejectionNote: null },
    });
    await database.subscriptionOrder.update({
      where: { id: payment.orderId },
      data: { status: "PAID", paidAt: now, activatedAt: now },
    });
    return { paymentId: payment.id, orderId: payment.orderId, status: "APPROVED" as const, startsAt, expiresAt };
  }, { isolationLevel: "Serializable" });
}
