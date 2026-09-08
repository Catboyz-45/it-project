/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “meters” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { billingMonthToDate, type MeterReadingInput } from "@/lib/domain/billing";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

const select = {
  id: true, type: true, billingMonth: true, previousReading: true,
  currentReading: true, unitRate: true, recordedAt: true,
  room: { select: { id: true, number: true } },
} as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “serialize” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - reading: ค่า “reading” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Meter Readings” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - billingMonth: ค่า “billing Month” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listMeterReadings(
  propertyId: string,
  pagination: PaginationInput,
  billingMonth?: string,
) {
  const rows = await getDatabase().meterReading.findMany({
    where: { propertyId, ...(billingMonth ? { billingMonth: billingMonthToDate(billingMonth) } : {}) },
    orderBy: [{ billingMonth: "desc" }, { room: { number: "asc" } }, { type: "asc" }],
    ...paginationQuery(pagination),
    select,
  });
  return toPaginatedResult(rows.map(serialize), pagination);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Meter Worksheet” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - billingMonth: ค่า “billing Month” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getMeterWorksheet(
  propertyId: string,
  billingMonth: string,
  type: "WATER" | "ELECTRICITY",
  pagination: PaginationInput,
) {
  const month = billingMonthToDate(billingMonth);
  const [settings, rooms] = await Promise.all([
    getDatabase().propertySettings.findUnique({
      where: { propertyId },
      select: { waterUnitRate: true, electricityUnitRate: true },
    }),
    getDatabase().room.findMany({
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
          where: { status: "ACTIVE", role: "PRIMARY" },
          take: 1,
          select: { tenantProfile: { select: { user: { select: { displayName: true } } } } },
        },
        meterReadings: {
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
  if (!settings) throw new ApiError(409, "กรุณาตั้งค่าอัตราค่าน้ำและค่าไฟก่อน");
  const configuredRate = type === "WATER" ? settings.waterUnitRate : settings.electricityUnitRate;
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “rows” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - room: ค่า “room” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const rows = rooms.map((room) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “exact” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - reading: ค่า “reading” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “record With Database” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - database: ตัวเชื่อมต่อฐานข้อมูลที่ใช้ใน transaction นี้
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “record Meter Reading” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function recordMeterReading(propertyId: string, userId: string, input: MeterReadingInput) {
  const row = await getDatabase().$transaction(
    (database) => recordWithDatabase(database, propertyId, userId, input),
    { isolationLevel: "Serializable" },
  );
  return serialize(row);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “record Meter Readings” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - inputs: ค่า “inputs” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function recordMeterReadings(propertyId: string, userId: string, inputs: MeterReadingInput[]) {
  const rows = await getDatabase().$transaction(async (database) => {
    const created = [];
    for (const input of inputs) created.push(await recordWithDatabase(database, propertyId, userId, input));
    return created;
  }, { isolationLevel: "Serializable" });
  return rows.map(serialize);
}
