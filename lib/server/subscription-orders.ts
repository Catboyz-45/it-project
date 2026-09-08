/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “subscription orders” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “serialize Order” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - order: ค่า “order” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function serializeOrder<T extends { amount: { toString(): string }; payments: Array<{ amount: { toString(): string } }> }>(order: T) {
  return {
    ...order,
    amount: order.amount.toString(),
    payments: order.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })),
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Property Subscription Orders” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listPropertySubscriptionOrders(propertyId: string, pagination: PaginationInput) {
  const rows = await getDatabase().subscriptionOrder.findMany({
    where: { propertyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: orderSelect,
  });
  return toPaginatedResult(rows.map(serializeOrder), pagination);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Subscription Order” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - createdByUserId: รหัสภายในของ created By User
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
        throw new ApiError(409, "หอนี้มีคำสั่งซื้อที่ยังดำเนินการไม่เสร็จ");
      }
      throw error;
    }
  }, { isolationLevel: "Serializable" });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Subscription Payment” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Pending Subscription Payments” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - query: ค่า “query” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Subscription Payment Slip” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - paymentId: รหัสภายในของ payment
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getSubscriptionPaymentSlip(paymentId: string) {
  const payment = await getDatabase().subscriptionPayment.findUnique({
    where: { id: paymentId },
    select: { storageKey: true, mimeType: true, order: { select: { orderNumber: true } } },
  });
  if (!payment) throw new ApiError(404, "ไม่พบหลักฐานการชำระ");
  return payment;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “add Billing Period” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - start: ค่า “start” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - interval: ค่า “interval” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function addBillingPeriod(start: Date, interval: "MONTHLY" | "YEARLY") {
  const end = new Date(start);
  if (interval === "YEARLY") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “review Subscription Payment” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - paymentId: รหัสภายในของ payment
 * - reviewedByUserId: รหัสภายในของ reviewed By User
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * - now: ค่า “now” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
