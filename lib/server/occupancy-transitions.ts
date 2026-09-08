/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “occupancy transitions” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { z } from "zod";
import { calculateDepositSettlement, occupancyTransitionSchema } from "@/lib/domain/occupancy-transitions";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Transition Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type TransitionInput = z.infer<typeof occupancyTransitionSchema>;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Move Out Readiness” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - effectiveDate: ค่า “effective Date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getMoveOutReadiness(
  propertyId: string,
  tenantProfileId: string,
  effectiveDate: Date,
) {
  const database = getDatabase();
  const occupancy = await database.roomOccupancy.findFirst({
    where: { propertyId, tenantProfileId, role: "PRIMARY", status: "ACTIVE" },
    select: { roomId: true, room: { select: { number: true } } },
  });
  if (!occupancy) throw new ApiError(404, "ไม่พบการเข้าพักหลักที่ใช้งานอยู่");

  const billingMonth = new Date(Date.UTC(effectiveDate.getUTCFullYear(), effectiveDate.getUTCMonth(), 1));
  const [readings, invoice] = await Promise.all([
    database.meterReading.findMany({
      where: { propertyId, roomId: occupancy.roomId, billingMonth },
      select: { type: true, recordedAt: true },
    }),
    database.invoice.findUnique({
      where: { roomId_billingMonth: { roomId: occupancy.roomId, billingMonth } },
      select: { id: true, invoiceNumber: true, status: true, issuedAt: true },
    }),
  ]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “water” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - reading: ค่า “reading” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const water = readings.find((reading) => reading.type === "WATER");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “electricity” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - reading: ค่า “reading” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const electricity = readings.find((reading) => reading.type === "ELECTRICITY");
  const invoiceReady = Boolean(invoice && ["PENDING", "OVERDUE", "PAID"].includes(invoice.status));

  return {
    billingMonth: billingMonth.toISOString().slice(0, 7),
    roomNumber: occupancy.room.number,
    meters: {
      ready: Boolean(water && electricity),
      waterRecordedAt: water?.recordedAt ?? null,
      electricityRecordedAt: electricity?.recordedAt ?? null,
    },
    invoice: {
      ready: invoiceReady,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      status: invoice?.status ?? null,
    },
    ready: Boolean(water && electricity && invoiceReady),
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “complete Occupancy Transition” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - completedByUserId: รหัสภายในของ completed By User
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function completeOccupancyTransition(
  propertyId: string,
  tenantProfileId: string,
  completedByUserId: string,
  input: TransitionInput,
) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (input.effectiveDate > endOfToday) {
    throw new ApiError(400, "วันที่มีผลต้องไม่เป็นวันในอนาคต เพราะรายการนี้จะดำเนินการทันที");
  }
  if (input.type === "MOVE_OUT") {
    const readiness = await getMoveOutReadiness(propertyId, tenantProfileId, input.effectiveDate);
    if (!readiness.meters.ready || !readiness.invoice.ready) {
      throw new ApiError(409, "ยังย้ายออกไม่ได้ กรุณาบันทึกมิเตอร์น้ำและไฟ พร้อมออกบิลสุดท้ายของเดือนที่ย้ายออกให้ครบ");
    }
  }

  return getDatabase().$transaction(async (database) => {
    const primaryOccupancy = await database.roomOccupancy.findFirst({
      where: { propertyId, tenantProfileId, role: "PRIMARY", status: "ACTIVE" },
      select: {
        id: true,
        roomId: true,
        room: { select: { number: true, depositAmount: true } },
      },
    });
    if (!primaryOccupancy) throw new ApiError(404, "ไม่พบการเข้าพักหลักที่ใช้งานอยู่");
    if (input.destinationRoomId === primaryOccupancy.roomId) throw new ApiError(409, "ห้องปลายทางต้องต่างจากห้องปัจจุบัน");

    // Serialize workflows touching the same rooms so capacity and occupancy
    // checks remain valid under concurrent move requests.
    const lockedRoomIds = [primaryOccupancy.roomId, input.destinationRoomId].filter((id): id is string => Boolean(id)).sort();
    for (const roomId of lockedRoomIds) {
      await database.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    }

    const household = await database.roomOccupancy.findMany({
      where: { propertyId, roomId: primaryOccupancy.roomId, status: "ACTIVE" },
      select: { id: true, tenantProfileId: true, role: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    const leaseLinks = await database.leaseTenant.findMany({
      where: { occupancyId: { in: household.map(({ id }) => id) } },
      orderBy: { lease: { createdAt: "desc" } },
      select: {
        isPrimary: true,
        lease: { select: { id: true, status: true, depositAmount: true, createdAt: true } },
      },
    });
    const currentLease = leaseLinks.find(({ isPrimary, lease }) => isPrimary && ["ACTIVE", "EXPIRING", "PENDING_SIGNATURE"].includes(lease.status))?.lease
      ?? leaseLinks.find(({ isPrimary }) => isPrimary)?.lease;
    const settlementLeaseIds = [...new Set(leaseLinks.map(({ lease }) => lease.id))];
    const outstanding = settlementLeaseIds.length
      ? await database.invoice.aggregate({
        where: { leaseId: { in: settlementLeaseIds }, status: { in: ["PENDING", "OVERDUE"] } },
        _sum: { total: true },
      })
      : null;
    const depositAmount = Number(currentLease?.depositAmount ?? primaryOccupancy.room.depositAmount);
    const outstandingAmount = Number(outstanding?._sum.total ?? 0);
    const settlement = calculateDepositSettlement(depositAmount, input.deductions, outstandingAmount);

    let destinationRoom: {
      id: string;
      number: string;
      capacity: number;
      _count: { occupancies: number };
    } | null = null;
    if (input.type === "MOVE_ROOM") {
      destinationRoom = await database.room.findFirst({
        where: { id: input.destinationRoomId, propertyId, status: { in: ["AVAILABLE", "OCCUPIED"] } },
        select: {
          id: true,
          number: true,
          capacity: true,
          _count: { select: { occupancies: { where: { status: { in: ["PENDING", "ACTIVE"] } } } } },
        },
      });
      if (!destinationRoom) throw new ApiError(404, "ไม่พบห้องปลายทางที่พร้อมใช้งาน");
      if (destinationRoom._count.occupancies + household.length > destinationRoom.capacity) {
        throw new ApiError(409, "จำนวนผู้พักเกินความจุของห้องปลายทาง");
      }
    }

    const endReason = `${input.type === "MOVE_ROOM" ? "ย้ายห้อง" : "ย้ายออก"}: ${input.reason}`;
    await database.lease.updateMany({
      where: { id: { in: settlementLeaseIds }, status: { in: ["ACTIVE", "EXPIRING"] } },
      data: { status: "EXPIRED", endedAt: input.effectiveDate },
    });
    await database.lease.updateMany({
      where: { id: { in: settlementLeaseIds }, status: "PENDING_SIGNATURE" },
      data: { status: "CANCELLED", endedAt: input.effectiveDate },
    });
    const endedOccupancies = await database.roomOccupancy.updateMany({
      where: { id: { in: household.map(({ id }) => id) }, status: "ACTIVE" },
      data: { status: "ENDED", endedAt: input.effectiveDate, endReason },
    });
    if (endedOccupancies.count !== household.length) throw new ApiError(409, "ข้อมูลการเข้าพักมีการเปลี่ยนแปลง กรุณาลองใหม่");
    await database.room.update({ where: { id: primaryOccupancy.roomId }, data: { status: "AVAILABLE" } });

    if (destinationRoom) {
      await database.roomOccupancy.createMany({
        data: household.map((occupancy) => ({
          propertyId,
          roomId: destinationRoom!.id,
          tenantProfileId: occupancy.tenantProfileId,
          role: occupancy.role,
          status: "ACTIVE" as const,
          startedAt: input.effectiveDate,
          approvedAt: new Date(),
          approvedByUserId: completedByUserId,
        })),
      });
      await database.room.update({ where: { id: destinationRoom.id }, data: { status: "OCCUPIED" } });
    }

    const transition = await database.occupancyTransition.create({
      data: {
        propertyId,
        type: input.type,
        primaryOccupancyId: primaryOccupancy.id,
        sourceRoomId: primaryOccupancy.roomId,
        destinationRoomId: destinationRoom?.id,
        effectiveDate: input.effectiveDate,
        reason: input.reason,
        depositAmount,
        deductions: input.deductions,
        outstandingAmount,
        refundAmount: input.type === "MOVE_OUT" ? settlement.refundAmount : 0,
        amountDue: settlement.amountDue,
        transferredAmount: input.type === "MOVE_ROOM" ? settlement.refundAmount : 0,
        settlementNote: input.settlementNote,
        completedByUserId,
      },
      select: {
        id: true, type: true, effectiveDate: true, depositAmount: true, deductions: true,
        outstandingAmount: true, refundAmount: true, amountDue: true, transferredAmount: true,
        sourceRoom: { select: { number: true } },
        destinationRoom: { select: { number: true } },
      },
    });
    return {
      ...transition,
      depositAmount: Number(transition.depositAmount),
      outstandingAmount: Number(transition.outstandingAmount),
      refundAmount: Number(transition.refundAmount),
      amountDue: Number(transition.amountDue),
      transferredAmount: Number(transition.transferredAmount),
    };
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Occupancy Transitions” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listOccupancyTransitions(propertyId: string, tenantProfileId: string) {
  const rows = await getDatabase().occupancyTransition.findMany({
    where: { propertyId, primaryOccupancy: { tenantProfileId } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true, type: true, effectiveDate: true, reason: true, depositAmount: true, deductions: true,
      outstandingAmount: true, refundAmount: true, amountDue: true, transferredAmount: true, createdAt: true,
      sourceRoom: { select: { number: true } }, destinationRoom: { select: { number: true } },
      completedBy: { select: { displayName: true } },
    },
  });
  return rows.map((row) => ({
    ...row,
    depositAmount: Number(row.depositAmount), outstandingAmount: Number(row.outstandingAmount),
    refundAmount: Number(row.refundAmount), amountDue: Number(row.amountDue), transferredAmount: Number(row.transferredAmount),
  }));
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Property Occupancy Transitions” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listPropertyOccupancyTransitions(propertyId: string) {
  const rows = await getDatabase().occupancyTransition.findMany({
    where: { propertyId }, orderBy: { createdAt: "desc" }, take: 100,
    select: {
      id: true, type: true, effectiveDate: true, reason: true, depositAmount: true,
      outstandingAmount: true, refundAmount: true, amountDue: true, transferredAmount: true, createdAt: true,
      sourceRoom: { select: { number: true } }, destinationRoom: { select: { number: true } },
      primaryOccupancy: { select: { tenantProfile: { select: { user: { select: { displayName: true } } } } } },
      completedBy: { select: { displayName: true } },
    },
  });
  return rows.map((row) => ({
    ...row,
    tenantName: row.primaryOccupancy.tenantProfile.user.displayName,
    primaryOccupancy: undefined,
    depositAmount: Number(row.depositAmount), outstandingAmount: Number(row.outstandingAmount),
    refundAmount: Number(row.refundAmount), amountDue: Number(row.amountDue), transferredAmount: Number(row.transferredAmount),
  }));
}
