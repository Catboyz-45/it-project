import { z } from "zod";
import { meterTypeSchema } from "@/lib/domain/enums";

// รอบบิลเป็น "YYYY-MM" regex บังคับให้เดือนอยู่ระหว่าง 01 ถึง 12 จริง ๆ ไม่ใช่แค่สองหลัก
export const billingMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// แปลงเป็นวันแรกของเดือนในระบบ UTC ตรึงเป็น UTC เพื่อให้รอบบิลไม่เลื่อนตามเขตเวลาของเครื่อง
export function billingMonthToDate(value: string) {
  billingMonthSchema.parse(value);
  return new Date(`${value}-01T00:00:00.000Z`);
}

export const meterReadingInputSchema = z.object({
  roomId: z.cuid(),
  type: meterTypeSchema,
  billingMonth: billingMonthSchema,
  previousReading: z.coerce.number().min(0).max(1_000_000_000).optional(),
  currentReading: z.coerce.number().min(0).max(1_000_000_000),
// เลขล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน เพราะมิเตอร์เดินหน้าอย่างเดียว
}).strict().refine(
  (value) => value.previousReading === undefined || value.currentReading >= value.previousReading,
  { message: "เลขมิเตอร์ล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน", path: ["currentReading"] },
);

export const bulkMeterReadingSchema = z.object({
  // รับทีเดียวได้ถึงหมื่นรายการ เพราะจดมิเตอร์ทั้งหอส่งมาครั้งเดียว
  readings: z.array(meterReadingInputSchema).min(1).max(10_000),
}).strict().superRefine((value, context) => {
  // ห้ามส่งห้องเดียวกัน ชนิดเดียวกัน เดือนเดียวกันมาซ้ำในคำขอเดียว ไม่งั้นจะเขียนทับกันเองโดยไม่รู้ตัว
  const seen = new Set<string>();
  value.readings.forEach((reading, index) => {
    const key = `${reading.roomId}:${reading.type}:${reading.billingMonth}`;
    if (seen.has(key)) context.addIssue({
      code: "custom", message: "มีรายการมิเตอร์ซ้ำในคำขอ", path: ["readings", index],
    });
    seen.add(key);
  });
});

export const generateInvoiceSchema = z.object({
  roomId: z.cuid(),
  billingMonth: billingMonthSchema,
  // literal(false) คือปิดทางออกบิลทันทีตั้งแต่ระดับตัวตรวจ ส่ง true มาก็ไม่ผ่าน
  // บิลต้องเกิดเป็นร่างเสมอ เพื่อให้มีจังหวะตรวจก่อนถึงผู้เช่า
  issueImmediately: z.literal(false).default(false),
}).strict();

export const generateBulkInvoicesSchema = z.object({
  billingMonth: billingMonthSchema,
  issueImmediately: z.literal(false).default(false),
}).strict();

// บังคับส่ง version มาด้วย เซิร์ฟเวอร์จะได้ปฏิเสธถ้ามีคนอื่นแก้บิลใบนี้ไปแล้ว
export const issueInvoiceSchema = z.object({
  version: z.number().int().positive(),
}).strict();

export const cancelInvoiceSchema = z.object({
  action: z.literal("cancel"),
  version: z.number().int().positive(),
  reason: z.string().trim().min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร").max(500),
}).strict();

export const recalculateOverdueSchema = z.object({
  asOf: z.coerce.date().optional(),
}).strict();

export type MeterReadingInput = z.infer<typeof meterReadingInputSchema>;
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

export type BillingLine = {
  type: "RENT" | "WATER" | "ELECTRICITY";
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  meterReadingId?: string;
};

// ปัดเป็นทศนิยมสองตำแหน่ง บวก EPSILON ก่อนเพราะเลขทศนิยมของคอมพิวเตอร์มีความคลาดเคลื่อน
// เช่น 1.005 ถูกเก็บจริงเป็น 1.00499... ถ้าปัดตรง ๆ จะได้ 1.00 แทนที่จะเป็น 1.01
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// คำนวณรายการในบิลจากค่าเช่าและหน่วยที่ใช้ ฟังก์ชันบริสุทธิ์ ไม่แตะฐานข้อมูล จึงทดสอบแยกได้
export function calculateInvoice(input: {
  monthlyRent: number;
  water?: { units: number; unitRate: number; meterReadingId: string };
  electricity?: { units: number; unitRate: number; meterReadingId: string };
}) {
  const lines: BillingLine[] = [{
    type: "RENT",
    description: "ค่าห้องรายเดือน",
    quantity: 1,
    unitPrice: money(input.monthlyRent),
    amount: money(input.monthlyRent),
  }];
  // วนค่าน้ำกับค่าไฟด้วยโค้ดชุดเดียว เพราะคิดเหมือนกัน คือหน่วยคูณอัตรา
  for (const [type, label, usage] of [
    ["WATER", "ค่าน้ำ", input.water],
    ["ELECTRICITY", "ค่าไฟ", input.electricity],
  ] as const) {
    // ห้องที่ไม่ได้จดมิเตอร์เดือนนั้นก็ข้ามไป ไม่ต้องมีรายการในบิล
    if (!usage) continue;
    const amount = money(usage.units * usage.unitRate);
    lines.push({
      type, description: label, quantity: usage.units,
      unitPrice: money(usage.unitRate), amount, meterReadingId: usage.meterReadingId,
    });
  }
  return { lines, subtotal: money(lines.reduce((sum, line) => sum + line.amount, 0)) };
}

// หาวันครบกำหนดชำระจากรอบบิล
export function calculateDueDate(month: Date, billingDay: number, dueDay: number) {
  const year = month.getUTCFullYear();
  // วันครบกำหนดมาก่อนวันออกบิล แปลว่าหมายถึงเดือนถัดไป เช่นออกบิลวันที่ 28 ครบกำหนดวันที่ 5
  const monthIndex = month.getUTCMonth() + (dueDay < billingDay ? 1 : 0);
  // วันที่ 0 ของเดือนถัดไปคือวันสุดท้ายของเดือนนี้ ใช้หนีบวันที่ 31 ในเดือนที่ไม่มี
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(dueDay, lastDay)));
}

// ค่าปรับคิดรายวันแบบนับเฉพาะวัน ไม่คิดเศษของวัน
export function calculateLateFee(dueDate: Date, asOf: Date, feePerDay: number, cap?: number | null) {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const now = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  // ตัดเวลาทั้งสองฝั่งเหลือแต่วันก่อนลบกัน จะได้ไม่ขึ้นกับว่าจดตอนกี่โมง
  // Math.max กันติดลบตอนยังไม่ถึงกำหนด
  const daysLate = Math.max(0, Math.floor((now - due) / 86_400_000));
  const fee = money(daysLate * feePerDay);
  // == null จับทั้ง null และ undefined ไม่ตั้งเพดานไว้ก็คิดตามจริงไม่มีขีดจำกัด
  return { daysLate, fee: cap == null ? fee : Math.min(fee, money(cap)) };
}
