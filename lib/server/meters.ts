import { billingMonthToDate, type MeterReadingInput } from "@/lib/domain/billing";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

// เลือกเฉพาะฟิลด์ที่หน้าจอใช้จริง ไม่ดึงข้อมูลทั้งแถว
const select = {
  id: true, type: true, billingMonth: true, previousReading: true,
  currentReading: true, unitRate: true, recordedAt: true,
  room: { select: { id: true, number: true } },
} as const;

// Prisma คืน Decimal มา แปลงเป็นสตริงก่อนส่งออกไป ส่งเป็น number ตรง ๆ จะปัดเศษเพี้ยน
const serialize = <T extends {
  previousReading: { toString(): string };
  currentReading: { toString(): string };
  unitRate: { toString(): string };
}>(reading: T) => ({
  ...reading,
  previousReading: reading.previousReading.toString(),
  currentReading: reading.currentReading.toString(),
  unitRate: reading.unitRate.toString(),
});

export async function listMeterReadings(
  propertyId: string,
  pagination: PaginationInput,
  billingMonth?: string,
) {
  const rows = await getDatabase().meterReading.findMany({
    where: { propertyId, ...(billingMonth ? { billingMonth: billingMonthToDate(billingMonth) } : {}) },
    // เรียงเดือนใหม่สุดก่อน แล้วเรียงห้องและชนิด ลำดับจะได้คงที่ทุกครั้งที่แบ่งหน้า
    orderBy: [{ billingMonth: "desc" }, { room: { number: "asc" } }, { type: "asc" }],
    ...paginationQuery(pagination),
    select,
  });
  return toPaginatedResult(rows.map(serialize), pagination);
}

// ใบจดมิเตอร์ของเดือนหนึ่ง รวมทุกห้องพร้อมเลขครั้งก่อนและเลขที่จดไปแล้ว
export async function getMeterWorksheet(
  propertyId: string,
  billingMonth: string,
  type: "WATER" | "ELECTRICITY",
  pagination: PaginationInput,
) {
  const month = billingMonthToDate(billingMonth);
  // ดึงอัตราค่าน้ำค่าไฟกับรายการห้องพร้อมกัน เพราะไม่ต้องรอผลของกันและกัน
  const [settings, rooms] = await Promise.all([
    getDatabase().propertySettings.findUnique({
      where: { propertyId },
      select: { waterUnitRate: true, electricityUnitRate: true },
    }),
    getDatabase().room.findMany({
      // ห้องที่ปิดใช้งานไม่ต้องจดมิเตอร์
      where: { propertyId, status: { not: "INACTIVE" } },
      orderBy: [
        { building: { code: "asc" } },
        { floor: { number: "asc" } },
        { number: "asc" },
      ],
      ...paginationQuery(pagination),
      select: {
        id: true,
        number: true,
        building: { select: { id: true, name: true, code: true } },
        floor: { select: { id: true, number: true, label: true } },
        occupancies: {
          // เอาชื่อผู้เช่าหลักคนเดียวมาแสดง เพื่อให้คนจดรู้ว่าห้องนี้ใครอยู่
          where: { status: "ACTIVE", role: "PRIMARY" },
          take: 1,
          select: { tenantProfile: { select: { user: { select: { displayName: true } } } } },
        },
        meterReadings: {
          // เอาสองแถวล่าสุดที่ไม่เกินเดือนนี้ อันหนึ่งคือของเดือนนี้ถ้าจดไปแล้ว อีกอันคือของรอบก่อนไว้เป็นเลขตั้งต้น
          // ดึงมาในคำสั่งเดียวพร้อมรายการห้อง เลี่ยงการยิงถามทีละห้องซึ่งช้ามาก
          where: { type, billingMonth: { lte: month } },
          orderBy: { billingMonth: "desc" },
          take: 2,
          select: {
            id: true,
            billingMonth: true,
            previousReading: true,
            currentReading: true,
            unitRate: true,
            recordedAt: true,
          },
        },
      },
    }),
  ]);
  // ยังไม่ได้ตั้งอัตราก็จดมิเตอร์ไปก็คำนวณเงินไม่ได้ จึงหยุดพร้อมบอกให้ไปตั้งค่าก่อน
  if (!settings) throw new ApiError(409, "กรุณาตั้งค่าอัตราค่าน้ำและค่าไฟก่อน");
  const configuredRate = type === "WATER" ? settings.waterUnitRate : settings.electricityUnitRate;
  const rows = rooms.map((room) => {
    // หาแถวของเดือนนี้เป๊ะ ๆ มีแปลว่าจดไปแล้ว แถวนั้นจะถูกล็อกไม่ให้แก้ซ้ำ
    const exact = room.meterReadings.find((reading) => reading.billingMonth.getTime() === month.getTime());
    const previous = exact
      ? undefined
      : room.meterReadings.find((reading) => reading.billingMonth < month);
    return {
      room: {
        id: room.id,
        number: room.number,
        building: room.building,
        floor: room.floor,
      },
      tenantName: room.occupancies[0]?.tenantProfile.user.displayName ?? null,
      readingId: exact?.id ?? null,
      previousReading: exact?.previousReading.toString()
        ?? previous?.currentReading.toString()
        ?? null,
      currentReading: exact?.currentReading.toString() ?? null,
      previousUsage: previous
        ? Number(previous.currentReading) - Number(previous.previousReading)
        : null,
      unitRate: exact?.unitRate.toString() ?? configuredRate.toString(),
      recordedAt: exact?.recordedAt ?? null,
    };
  });
  return toPaginatedResult(rows, pagination);
}

async function recordWithDatabase(
  database: Prisma.TransactionClient,
  propertyId: string,
  userId: string,
  input: MeterReadingInput,
) {
  const month = billingMonthToDate(input.billingMonth);
  const [room, existing, previous, later] = await Promise.all([
    database.room.findFirst({
      where: { id: input.roomId, propertyId, status: { not: "INACTIVE" } },
      select: { id: true },
    }),
    database.meterReading.findUnique({
      where: { roomId_type_billingMonth: { roomId: input.roomId, type: input.type, billingMonth: month } },
      select: { id: true },
    }),
    database.meterReading.findFirst({
      where: { roomId: input.roomId, type: input.type, billingMonth: { lt: month } },
      orderBy: { billingMonth: "desc" },
      select: { currentReading: true },
    }),
    database.meterReading.findFirst({
      where: { roomId: input.roomId, type: input.type, billingMonth: { gt: month } },
      select: { id: true },
    }),
  ]);
  if (!room) throw new ApiError(404, "ไม่พบห้องพัก");
  if (existing) throw new ApiError(409, "บันทึกมิเตอร์ประเภทนี้ของเดือนนี้แล้ว");
  if (later) throw new ApiError(409, "ไม่สามารถเพิ่มเลขมิเตอร์ย้อนหลังหลังจากมีข้อมูลเดือนถัดไป");
  if (!previous && input.previousReading === undefined) {
    throw new ApiError(400, "การบันทึกครั้งแรกต้องระบุเลขมิเตอร์ครั้งก่อน");
  }
  const previousReading = previous ? Number(previous.currentReading) : input.previousReading!;
  if (input.currentReading < previousReading) {
    throw new ApiError(400, "เลขมิเตอร์ล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน");
  }
  const settings = await database.propertySettings.findUnique({
    where: { propertyId },
    select: { waterUnitRate: true, electricityUnitRate: true },
  });
  // ยังไม่ได้ตั้งอัตราก็จดมิเตอร์ไปก็คำนวณเงินไม่ได้ จึงหยุดพร้อมบอกให้ไปตั้งค่าก่อน
  if (!settings) throw new ApiError(409, "กรุณาตั้งค่าอัตราค่าน้ำและค่าไฟก่อน");
  const unitRate = input.type === "WATER" ? settings.waterUnitRate : settings.electricityUnitRate;
  return database.meterReading.create({
    data: {
      propertyId, roomId: input.roomId, type: input.type, billingMonth: month,
      previousReading, currentReading: input.currentReading, unitRate, recordedById: userId,
    },
    select,
  });
}

export async function recordMeterReading(propertyId: string, userId: string, input: MeterReadingInput) {
  const row = await getDatabase().$transaction(
    (database) => recordWithDatabase(database, propertyId, userId, input),
    { isolationLevel: "Serializable" },
  );
  return serialize(row);
}

export async function recordMeterReadings(propertyId: string, userId: string, inputs: MeterReadingInput[]) {
  const rows = await getDatabase().$transaction(async (database) => {
    const created = [];
    for (const input of inputs) created.push(await recordWithDatabase(database, propertyId, userId, input));
    return created;
  }, { isolationLevel: "Serializable" });
  return rows.map(serialize);
}
