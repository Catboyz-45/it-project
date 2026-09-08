/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “invoices” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { Prisma } from "@/generated/prisma/client";
import {
  billingMonthToDate,
  calculateDueDate,
  calculateInvoice,
  calculateLateFee,
  type GenerateInvoiceInput,
} from "@/lib/domain/billing";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

const invoiceSelect = {
  id: true, invoiceNumber: true, billingMonth: true, status: true,
  issuedAt: true, dueDate: true, subtotal: true, lateFee: true, total: true,
  paidAt: true, cancelledAt: true, cancellationNote: true, version: true, createdAt: true,
  room: {
    select: {
      id: true, number: true,
      occupancies: {
        where: { status: "ACTIVE", role: "PRIMARY" },
        take: 1,
        select: { tenantProfile: { select: { user: { select: { displayName: true } } } } },
      },
    },
  },
  items: {
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, type: true, description: true, quantity: true, unitPrice: true, amount: true, meterReadingId: true },
  },
} as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “serialize” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - invoice: ค่า “invoice” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const serialize = <T extends {
  subtotal: { toString(): string }; lateFee: { toString(): string }; total: { toString(): string };
  items: Array<{ quantity: { toString(): string }; unitPrice: { toString(): string }; amount: { toString(): string } }>;
}>(invoice: T) => ({
  ...invoice,
  subtotal: invoice.subtotal.toString(),
  lateFee: invoice.lateFee.toString(),
  total: invoice.total.toString(),
  items: invoice.items.map((item) => ({
    ...item, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), amount: item.amount.toString(),
  })),
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “prepare With Database” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - database: ตัวเชื่อมต่อฐานข้อมูลที่ใช้ใน transaction นี้
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function prepareWithDatabase(
  database: Prisma.TransactionClient,
  propertyId: string,
  input: GenerateInvoiceInput,
) {
  const billingMonth = billingMonthToDate(input.billingMonth);
  const [room, settings, existing] = await Promise.all([
    database.room.findFirst({
      where: {
        id: input.roomId, propertyId, status: "OCCUPIED",
        occupancies: { some: { role: "PRIMARY", status: "ACTIVE" } },
      },
      select: {
        id: true, number: true, monthlyRent: true,
        occupancies: {
          where: { status: "ACTIVE", role: "PRIMARY" }, take: 1,
          select: { tenantProfile: { select: { user: { select: { displayName: true } } } } },
        },
        leases: {
          where: { status: { in: ["ACTIVE", "EXPIRING"] } },
          orderBy: { createdAt: "desc" }, take: 1, select: { id: true, monthlyRent: true },
        },
      },
    }),
    database.propertySettings.findUnique({ where: { propertyId } }),
    database.invoice.findUnique({
      where: { roomId_billingMonth: { roomId: input.roomId, billingMonth } },
      select: { id: true },
    }),
  ]);
  if (!room) throw new ApiError(409, "ห้องต้องมีผู้เช่าหลักที่ใช้งานอยู่");
  if (!settings) throw new ApiError(409, "กรุณาตั้งค่าหอก่อนสร้างบิล");
  if (existing) throw new ApiError(409, "ห้องนี้มีบิลของเดือนดังกล่าวแล้ว");

  const readings = await database.meterReading.findMany({
    where: { roomId: room.id, billingMonth },
    select: { id: true, type: true, previousReading: true, currentReading: true, unitRate: true },
  });
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “reading” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - type: ค่า “type” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const reading = (type: "WATER" | "ELECTRICITY") => readings.find((item) => item.type === type);
  const water = reading("WATER");
  const electricity = reading("ELECTRICITY");
  if (Number(settings.waterUnitRate) > 0 && !water) throw new ApiError(409, `ห้อง ${room.number} ยังไม่มีเลขมิเตอร์น้ำ`);
  if (Number(settings.electricityUnitRate) > 0 && !electricity) throw new ApiError(409, `ห้อง ${room.number} ยังไม่มีเลขมิเตอร์ไฟ`);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “usage” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const usage = (value: typeof water) => value ? Number(value.currentReading) - Number(value.previousReading) : 0;
  const calculation = calculateInvoice({
    monthlyRent: Number(room.leases[0]?.monthlyRent ?? room.monthlyRent),
    ...(water ? { water: { units: usage(water), unitRate: Number(water.unitRate), meterReadingId: water.id } } : {}),
    ...(electricity ? { electricity: { units: usage(electricity), unitRate: Number(electricity.unitRate), meterReadingId: electricity.id } } : {}),
  });
  const dueDate = calculateDueDate(billingMonth, settings.billingDay, settings.dueDay);
  const monthCode = input.billingMonth.replace("-", "");
  const invoiceNumber = `${settings.invoicePrefix}-${monthCode}-${room.number}`.slice(0, 50);
  return { billingMonth, calculation, dueDate, invoiceNumber, room };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create With Database” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - database: ตัวเชื่อมต่อฐานข้อมูลที่ใช้ใน transaction นี้
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function createWithDatabase(
  database: Prisma.TransactionClient,
  propertyId: string,
  input: GenerateInvoiceInput,
) {
  const prepared = await prepareWithDatabase(database, propertyId, input);
  const { billingMonth, calculation, dueDate, invoiceNumber, room } = prepared;
  return database.invoice.create({
    data: {
      propertyId, roomId: room.id, leaseId: room.leases[0]?.id,
      invoiceNumber, billingMonth,
      status: "DRAFT",
      issuedAt: null,
      dueDate, subtotal: calculation.subtotal, total: calculation.subtotal,
      items: {
        create: calculation.lines.map((line, index) => ({
          type: line.type, description: line.description, quantity: line.quantity,
          unitPrice: line.unitPrice, amount: line.amount,
          meterReadingId: line.meterReadingId, sortOrder: index,
        })),
      },
    },
    select: invoiceSelect,
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “preflight Invoices” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function preflightInvoices(
  propertyId: string,
  input: { billingMonth: string; roomId?: string },
) {
  return getDatabase().$transaction(async (database) => {
    const rooms = input.roomId
      ? await database.room.findMany({ where: { id: input.roomId, propertyId }, select: { id: true, number: true } })
      : await database.room.findMany({
        where: { propertyId, status: "OCCUPIED", occupancies: { some: { role: "PRIMARY", status: "ACTIVE" } } },
        orderBy: { number: "asc" }, select: { id: true, number: true },
      });
    if (input.roomId && rooms.length === 0) throw new ApiError(404, "ไม่พบห้อง");
    const ready: Array<{
      roomId: string; roomNumber: string; tenantName: string; dueDate: Date;
      subtotal: string; items: Array<{ type: string; description: string; quantity: string; unitPrice: string; amount: string }>;
    }> = [];
    const blocked: Array<{ roomId: string; roomNumber: string; reason: string }> = [];
    for (const target of rooms) {
      try {
        const prepared = await prepareWithDatabase(database, propertyId, { billingMonth: input.billingMonth, roomId: target.id, issueImmediately: false });
        ready.push({
          roomId: target.id,
          roomNumber: target.number,
          tenantName: prepared.room.occupancies[0]?.tenantProfile.user.displayName ?? "-",
          dueDate: prepared.dueDate,
          subtotal: prepared.calculation.subtotal.toFixed(2),
          items: prepared.calculation.lines.map((line) => ({
            type: line.type, description: line.description,
            quantity: line.quantity.toFixed(2), unitPrice: line.unitPrice.toFixed(2), amount: line.amount.toFixed(2),
          })),
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status >= 500) throw error;
        blocked.push({ roomId: target.id, roomNumber: target.number, reason: error.message });
      }
    }
    return {
      billingMonth: input.billingMonth,
      ready,
      blocked,
      summary: {
        targetCount: rooms.length,
        readyCount: ready.length,
        blockedCount: blocked.length,
        total: ready.reduce((sum, item) => sum + Number(item.subtotal), 0).toFixed(2),
      },
    };
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Invoices” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - billingMonth: ค่า “billing Month” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - filters: ค่า “filters” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listInvoices(
  propertyId: string,
  pagination: PaginationInput,
  billingMonth?: string,
  filters?: {
    status?: "DRAFT" | "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
    query?: string;
  },
) {
  const query = filters?.query?.trim();
  const where: Prisma.InvoiceWhereInput = {
      propertyId,
      ...(billingMonth ? { billingMonth: billingMonthToDate(billingMonth) } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(query ? {
        OR: [
          { invoiceNumber: { contains: query, mode: "insensitive" } },
          { room: { number: { contains: query, mode: "insensitive" } } },
          { room: { occupancies: { some: {
            status: "ACTIVE",
            role: "PRIMARY",
            tenantProfile: { user: { displayName: { contains: query, mode: "insensitive" } } },
          } } } },
        ],
      } : {}),
  };
  const [rows, total, draft, paid, pending, overdue, amount] = await getDatabase().$transaction([
    getDatabase().invoice.findMany({
      where,
      orderBy: [{ billingMonth: "desc" }, { room: { number: "asc" } }],
      ...paginationQuery(pagination), select: invoiceSelect,
    }),
    getDatabase().invoice.count({ where }),
    getDatabase().invoice.count({ where: { propertyId, status: "DRAFT" } }),
    getDatabase().invoice.count({ where: { propertyId, status: "PAID" } }),
    getDatabase().invoice.count({ where: { propertyId, status: "PENDING" } }),
    getDatabase().invoice.count({ where: { propertyId, status: "OVERDUE" } }),
    getDatabase().invoice.aggregate({ where: { propertyId }, _sum: { total: true } }),
  ]);
  const result = toPaginatedResult(rows.map(serialize), pagination, total);
  return {
    ...result,
    summary: {
      draft,
      paid,
      pending,
      overdue,
      total: amount._sum.total?.toString() ?? "0",
    },
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกอบหรือคำนวณผลลัพธ์ของ “generate Invoice” จากข้อมูลที่ได้รับ
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function generateInvoice(propertyId: string, input: GenerateInvoiceInput) {
  const row = await getDatabase().$transaction(
    (database) => createWithDatabase(database, propertyId, input),
    { isolationLevel: "Serializable" },
  );
  return serialize(row);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกอบหรือคำนวณผลลัพธ์ของ “generate Bulk Invoices” จากข้อมูลที่ได้รับ
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function generateBulkInvoices(
  propertyId: string,
  input: Omit<GenerateInvoiceInput, "roomId">,
) {
  return getDatabase().$transaction(async (database) => {
    const rooms = await database.room.findMany({
      where: {
        propertyId, status: "OCCUPIED",
        occupancies: { some: { role: "PRIMARY", status: "ACTIVE" } },
      },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    });
    const created = [];
    const skipped: Array<{ roomId: string; roomNumber: string; reason: string }> = [];
    for (const room of rooms) {
      try {
        const invoice = await createWithDatabase(database, propertyId, { ...input, roomId: room.id });
        created.push(serialize(invoice));
      } catch (error) {
        if (!(error instanceof ApiError) || error.status >= 500) throw error;
        skipped.push({ roomId: room.id, roomNumber: room.number, reason: error.message });
      }
    }
    return { created, skipped };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “issue Invoice” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - invoiceId: รหัสภายในของบิล
 * - version: ค่า “version” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function issueInvoice(propertyId: string, invoiceId: string, version: number) {
  const result = await getDatabase().invoice.updateMany({
    where: { id: invoiceId, propertyId, status: "DRAFT", version },
    data: { status: "PENDING", issuedAt: new Date(), version: { increment: 1 } },
  });
  if (result.count === 0) {
    const invoice = await getDatabase().invoice.findFirst({
      where: { id: invoiceId, propertyId },
      select: { status: true, version: true },
    });
    if (!invoice) throw new ApiError(404, "ไม่พบบิล");
    if (invoice.status !== "DRAFT") throw new ApiError(409, "ออกบิลได้เฉพาะฉบับร่าง");
    throw new ApiError(409, "ร่างบิลถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนออกบิล");
  }
  const invoice = await getDatabase().invoice.findFirst({
    where: { id: invoiceId, propertyId },
    select: invoiceSelect,
  });
  if (!invoice) throw new ApiError(404, "ไม่พบบิล");
  return serialize(invoice);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “cancel Invoice” ตามกฎของระบบ
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - invoiceId: รหัสภายในของบิล
 * - version: ค่า “version” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - reason: ค่า “reason” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function cancelInvoice(propertyId: string, invoiceId: string, version: number, reason: string) {
  const cancellationNote = reason.trim();
  const invoice = await getDatabase().$transaction(async (database) => {
    const invoice = await database.invoice.findFirst({
      where: { id: invoiceId, propertyId },
      select: {
        status: true,
        version: true,
        paymentSubmissions: {
          where: { status: { in: ["PENDING_REVIEW", "APPROVED"] } },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!invoice) throw new ApiError(404, "ไม่พบบิล");
    if (!["DRAFT", "PENDING", "OVERDUE"].includes(invoice.status)) {
      throw new ApiError(409, invoice.status === "PAID" ? "ไม่สามารถยกเลิกบิลที่ชำระแล้ว" : "บิลนี้ถูกยกเลิกแล้ว");
    }
    if (invoice.version !== version) throw new ApiError(409, "บิลถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนยกเลิก");
    if (invoice.paymentSubmissions.length > 0) throw new ApiError(409, "กรุณาปฏิเสธหรือตรวจสอบหลักฐานการชำระให้เสร็จก่อนยกเลิกบิล");
    return database.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationNote,
        version: { increment: 1 },
      },
      select: invoiceSelect,
    });
  }, { isolationLevel: "Serializable" });
  return serialize(invoice);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “recalculate Overdue Invoices With Database” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - database: ตัวเชื่อมต่อฐานข้อมูลที่ใช้ใน transaction นี้
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - asOf: ค่า “as Of” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - requireSettings: ค่า “require Settings” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function recalculateOverdueInvoicesWithDatabase(
  database: Prisma.TransactionClient,
  propertyId: string,
  asOf: Date,
  requireSettings = true,
) {
    const settings = await database.propertySettings.findUnique({
      where: { propertyId },
      select: { lateFeePerDay: true, lateFeeCap: true },
    });
    if (!settings && requireSettings) throw new ApiError(409, "กรุณาตั้งค่าหอก่อน");
    const invoices = await database.invoice.findMany({
      where: { propertyId, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { lt: asOf } },
      select: { id: true, dueDate: true, subtotal: true, items: { where: { type: "LATE_FEE" }, take: 1, select: { id: true } } },
    });
    for (const invoice of invoices) {
      const late = calculateLateFee(
        invoice.dueDate, asOf, Number(settings?.lateFeePerDay ?? 0),
        settings?.lateFeeCap == null ? null : Number(settings.lateFeeCap),
      );
      if (late.daysLate === 0) continue;
      const item = {
        description: `ค่าปรับล่าช้า ${late.daysLate} วัน`,
        quantity: late.daysLate, unitPrice: Number(settings?.lateFeePerDay ?? 0),
        amount: late.fee, sortOrder: 999,
      };
      if (invoice.items[0] && late.fee === 0) {
        await database.invoiceItem.delete({ where: { id: invoice.items[0].id } });
      } else if (invoice.items[0]) {
        await database.invoiceItem.update({ where: { id: invoice.items[0].id }, data: item });
      } else if (late.fee > 0) {
        await database.invoiceItem.create({ data: { invoiceId: invoice.id, type: "LATE_FEE", ...item } });
      }
      await database.invoice.update({
        where: { id: invoice.id },
        data: { status: "OVERDUE", lateFee: late.fee, total: Number(invoice.subtotal) + late.fee },
      });
    }
    return { updated: invoices.length, asOf };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “recalculate Overdue Invoices” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - asOf: ค่า “as Of” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function recalculateOverdueInvoices(propertyId: string, asOf = new Date()) {
  return getDatabase().$transaction(
    (database) => recalculateOverdueInvoicesWithDatabase(database, propertyId, asOf),
  );
}
