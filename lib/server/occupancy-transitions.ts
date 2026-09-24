import type { z } from "zod";
import { calculateDepositSettlement, occupancyTransitionSchema } from "@/lib/domain/occupancy-transitions";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

type TransitionInput = z.infer<typeof occupancyTransitionSchema>;

// ตรวจว่าย้ายออกได้หรือยัง ต้องมีมิเตอร์น้ำไฟของเดือนที่ย้ายและบิลสุดท้ายที่พ้นสถานะร่างแล้ว
// ตรวจฝั่งเซิร์ฟเวอร์ ไม่ให้ฝั่งเบราว์เซอร์เป็นคนตัดสิน
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
  const water = readings.find((reading) => reading.type === "WATER");
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

// ทำรายการย้ายออกหรือย้ายห้องให้เสร็จ ปิดสัญญาเดิม สรุปเงินประกัน และย้ายทุกคนในห้อง
export async function completeOccupancyTransition(
  propertyId: string,
  tenantProfileId: string,
  completedByUserId: string,
  input: TransitionInput,
) {
  // ห้ามตั้งวันในอนาคต เพราะรายการนี้มีผลทันทีที่กด ไม่ได้รอถึงวันนั้น
  // เทียบกับสิ้นวันของวันนี้ ผู้ใช้จะได้เลือกวันนี้ได้ไม่ว่าจะกดตอนกี่โมง
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (input.effectiveDate > endOfToday) {
    throw new ApiError(400, "วันที่มีผลต้องไม่เป็นวันในอนาคต เพราะรายการนี้จะดำเนินการทันที");
  }
  // ตรวจความพร้อมก่อนเข้า transaction เพราะถ้าไม่ผ่านก็ไม่ต้องไปล็อกอะไรเลย
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
    // ย้ายไปห้องเดิมไม่มีความหมาย และจะทำให้ลำดับการปิดกับเปิดการเข้าพักพันกัน
    if (input.destinationRoomId === primaryOccupancy.roomId) throw new ApiError(409, "ห้องปลายทางต้องต่างจากห้องปัจจุบัน");

    // ล็อกแถวของห้องที่เกี่ยวข้องไว้ก่อน การตรวจความจุกับจำนวนผู้พักจะได้ยังจริงอยู่
    // ตอนที่มีคำขอย้ายเข้าห้องเดียวกันหลายอันพร้อมกัน
    // เรียง id ก่อนล็อกเสมอ เพราะสองคำขอที่ล็อกห้องคู่เดียวกันคนละลำดับจะทำให้ติดตายทั้งคู่
    // เทียบแบบ code unit ตรง ๆ ไม่ใช้ localeCompare เพราะกฎการเรียงตามภาษาขึ้นกับเวอร์ชัน ICU
    // ของแต่ละเครื่อง สองโพรเซสอาจได้ลำดับต่างกันจนล็อกสลับกันแล้วติดตายทั้งคู่
    const lockedRoomIds = [primaryOccupancy.roomId, input.destinationRoomId]
      .filter((id): id is string => Boolean(id))
      .sort((left, right) => (left < right ? -1 : Number(left > right)));
    for (const roomId of lockedRoomIds) {
      // FOR UPDATE คือการล็อกแถวไว้จนกว่า transaction จะจบ ไม่ได้ต้องการข้อมูลที่อ่านมา
      await database.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    }

    // ย้ายทั้งห้อง ไม่ใช่แค่ผู้เช่าหลัก ผู้พักร่วมต้องไปด้วยกันหมด
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
    // เอาสัญญาที่ยังใช้งานอยู่ก่อน ไม่มีค่อยถอยไปสัญญาล่าสุดของผู้เช่าหลัก
    const currentLease = leaseLinks.find(({ isPrimary, lease }) => isPrimary && ["ACTIVE", "EXPIRING", "PENDING_SIGNATURE"].includes(lease.status))?.lease
      ?? leaseLinks.find(({ isPrimary }) => isPrimary)?.lease;
    const settlementLeaseIds = [...new Set(leaseLinks.map(({ lease }) => lease.id))];
    // รวมบิลที่ยังไม่จ่ายของทุกสัญญาในห้องนี้ เอาไปหักจากเงินประกัน
    const outstanding = settlementLeaseIds.length
      ? await database.invoice.aggregate({
        where: { leaseId: { in: settlementLeaseIds }, status: { in: ["PENDING", "OVERDUE"] } },
        _sum: { total: true },
      })
      : null;
    // เงินประกันเอาจากสัญญาก่อน ไม่มีสัญญาค่อยใช้ค่าที่ตั้งไว้ในห้อง
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
      // เช็คห้องปลายทางหลังล็อกแล้ว ผลจึงยังจริงอยู่จนจบ transaction
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
    // ปิดการเข้าพักได้ไม่ครบทุกคน แปลว่ามีอะไรเปลี่ยนไประหว่างนั้น ต้องยกเลิกทั้งหมดแล้วให้ลองใหม่
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
