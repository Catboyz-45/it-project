/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “dashboard aggregation” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { getDatabase } from "@/lib/server/db";
import { monthlyEquivalent, usagePercent } from "@/lib/domain/saas";
import { getServerEnv } from "@/lib/server/env";
import { getSubscriptionAccessState } from "@/lib/server/subscription-guard";
import { leaseExpiryWindow } from "@/lib/domain/lease-expiry";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “month Key” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - date: ค่า “date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Owner Dashboard Aggregation” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getOwnerDashboardAggregation(propertyId: string) {
  const now = new Date();
  const expiryWindow = leaseExpiryWindow(now);
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [
    property, roomGroups, activeOccupancies, pendingOccupancies, expiringLeases,
    invoices, pendingPayments, openTickets, waitingParcels, unreadTenantMessages,
  ] = await Promise.all([
    getDatabase().property.findUnique({
      where: { id: propertyId },
      select: {
        id: true, name: true,
        subscription: {
          include: {
            plan: {
              select: {
                code: true,
                name: true,
                allowPromptPay: true,
                allowFileUploads: true,
                allowPrioritySupport: true,
              },
            },
          },
        },
      },
    }),
    getDatabase().room.groupBy({ by: ["status"], where: { propertyId, status: { not: "INACTIVE" } }, _count: true }),
    getDatabase().roomOccupancy.count({ where: { propertyId, status: "ACTIVE" } }),
    getDatabase().roomOccupancy.count({ where: { propertyId, status: "PENDING" } }),
    getDatabase().lease.count({
      where: {
        propertyId,
        status: { in: ["ACTIVE", "EXPIRING"] },
        endDate: {
          gte: expiryWindow.from,
          lte: expiryWindow.to,
        },
      },
    }),
    getDatabase().invoice.findMany({
      where: { propertyId, billingMonth: { gte: trendStart }, status: { not: "CANCELLED" } },
      select: { billingMonth: true, status: true, total: true },
    }),
    getDatabase().paymentSubmission.count({ where: { propertyId, status: "PENDING_REVIEW" } }),
    getDatabase().serviceTicket.count({ where: { propertyId, status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] } } }),
    getDatabase().parcel.count({ where: { propertyId, status: "WAITING" } }),
    getDatabase().$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "ChatMessage" message
      INNER JOIN "ChatConversation" conversation ON conversation."id" = message."conversationId"
      WHERE message."propertyId" = ${propertyId}
        AND message."senderRole" = 'TENANT'
        AND conversation."type" = 'TENANT_PROPERTY'
        AND (conversation."lastAdminReadAt" IS NULL OR message."createdAt" > conversation."lastAdminReadAt")
    `.then((rows) => Number(rows[0]?.count ?? 0)),
  ]);
  if (!property) return null;
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “rooms By Status” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const roomsByStatus = Object.fromEntries(roomGroups.map((item) => [item.status, item._count]));
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: แปลงข้อมูลในขั้นตอน “total Rooms” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
   * รับค่า:
   * - sum: ค่า “sum” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const totalRooms = roomGroups.reduce((sum, item) => sum + item._count, 0);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “current Invoices” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const currentInvoices = invoices.filter((item) => monthKey(item.billingMonth) === monthKey(currentMonth));
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “sum” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - rows: ค่า “rows” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const sum = (rows: typeof invoices) => rows.reduce((total, row) => total + Number(row.total), 0);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “trends” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - _: ค่า “” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - index: ค่า “index” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const trends = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “rows” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const rows = invoices.filter((item) => monthKey(item.billingMonth) === monthKey(month));
    return {
      month: monthKey(month),
      billed: sum(rows),
      collected: sum(rows.filter((item) => item.status === "PAID")),
      outstanding: sum(rows.filter((item) => item.status === "PENDING" || item.status === "OVERDUE")),
    };
  });
  const subscription = property.subscription;
  const subscriptionAccess = getSubscriptionAccessState(
    subscription,
    now,
    getServerEnv().SUBSCRIPTION_GRACE_PERIOD_DAYS,
  );
  return {
    property: { id: property.id, name: property.name },
    rooms: {
      total: totalRooms,
      occupied: roomsByStatus.OCCUPIED ?? 0,
      available: roomsByStatus.AVAILABLE ?? 0,
      maintenance: roomsByStatus.MAINTENANCE ?? 0,
      occupancyRate: totalRooms ? Math.round(((roomsByStatus.OCCUPIED ?? 0) / totalRooms) * 10_000) / 100 : 0,
    },
    activeOccupancies,
    pendingOccupancies,
    finance: {
      billed: sum(currentInvoices),
      collected: sum(currentInvoices.filter((item) => item.status === "PAID")),
      outstanding: sum(currentInvoices.filter((item) => item.status === "PENDING" || item.status === "OVERDUE")),
      overdueInvoices: currentInvoices.filter((item) => item.status === "OVERDUE").length,
      pendingPayments,
    },
    operations: { openTickets, waitingParcels, unreadTenantMessages, expiringLeases },
    subscription: subscription ? {
      accessMode: subscriptionAccess.mode,
      graceEndsAt: subscriptionAccess.graceEndsAt,
      isReadOnly: subscriptionAccess.isReadOnly,
      planCode: subscription.plan?.code ?? null,
      planName: subscription.plan?.name ?? subscription.planName,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      priceAmount: subscription.priceAmount.toString(),
      startsAt: subscription.startsAt,
      expiresAt: subscription.expiresAt,
      maxRooms: subscription.maxRooms,
      usedRooms: totalRooms,
      roomUsagePercent: usagePercent(totalRooms, subscription.maxRooms),
    } : null,
    trends,
    generatedAt: now,
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Super Admin Dashboard Aggregation” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getSuperAdminDashboardAggregation() {
  const now = new Date();
  const expiringAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [properties, users, subscriptions, roomCount, tenantCount, pendingPayments, openTickets] = await Promise.all([
    getDatabase().property.count({ where: { isActive: true } }),
    getDatabase().user.groupBy({ by: ["role"], where: { isActive: true, approvalStatus: "APPROVED" }, _count: true }),
    getDatabase().propertySubscription.findMany({
      include: { plan: { select: { code: true, name: true } }, property: { select: { name: true, isActive: true } } },
      orderBy: { expiresAt: "asc" },
    }),
    getDatabase().room.count({ where: { status: { not: "INACTIVE" } } }),
    getDatabase().roomOccupancy.count({ where: { status: "ACTIVE" } }),
    getDatabase().paymentSubmission.count({ where: { status: "PENDING_REVIEW" } }),
    getDatabase().serviceTicket.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] } } }),
  ]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “active” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const active = subscriptions.filter((item) => item.status === "ACTIVE" && item.expiresAt > now);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “mrr” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - sum: ค่า “sum” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const mrr = active.reduce((sum, item) => sum + monthlyEquivalent(Number(item.priceAmount), item.billingInterval), 0);
  const breakdown = new Map<string, { code: string | null; name: string; subscriptions: number; mrr: number }>();
  for (const item of active) {
    const key = item.planId ?? item.planName;
    const current = breakdown.get(key) ?? { code: item.plan?.code ?? null, name: item.plan?.name ?? item.planName, subscriptions: 0, mrr: 0 };
    current.subscriptions += 1;
    current.mrr += monthlyEquivalent(Number(item.priceAmount), item.billingInterval);
    breakdown.set(key, current);
  }
  return {
    properties: { active: properties, totalSubscriptions: subscriptions.length },
    users: Object.fromEntries(users.map((item) => [item.role, item._count])),
    usage: { rooms: roomCount, activeTenants: tenantCount },
    revenue: { mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100 },
    subscriptions: {
      active: active.length,
      trial: subscriptions.filter((item) => item.status === "TRIAL").length,
      suspended: subscriptions.filter((item) => item.status === "SUSPENDED").length,
      expired: subscriptions.filter((item) => item.status === "EXPIRED" || item.expiresAt <= now).length,
      expiringWithin30Days: subscriptions.filter((item) => item.status === "ACTIVE" && item.expiresAt > now && item.expiresAt <= expiringAt).length,
      byPlan: [...breakdown.values()].map((item) => ({ ...item, mrr: Math.round(item.mrr * 100) / 100 })),
    },
    operations: { pendingPayments, openTickets },
    generatedAt: now,
  };
}
