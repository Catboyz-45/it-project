/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “billing” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";
import { meterTypeSchema } from "@/lib/domain/enums";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “billing Month Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const billingMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “billing Month To Date” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function billingMonthToDate(value: string) {
  billingMonthSchema.parse(value);
  return new Date(`${value}-01T00:00:00.000Z`);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “meter Reading Input Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const meterReadingInputSchema = z.object({
  roomId: z.string().cuid(),
  type: meterTypeSchema,
  billingMonth: billingMonthSchema,
  previousReading: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  currentReading: z.coerce.number().finite().min(0).max(1_000_000_000),
}).strict().refine(
  (value) => value.previousReading === undefined || value.currentReading >= value.previousReading,
  { message: "เลขมิเตอร์ล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน", path: ["currentReading"] },
);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “bulk Meter Reading Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export const bulkMeterReadingSchema = z.object({
  readings: z.array(meterReadingInputSchema).min(1).max(10_000),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.readings.forEach((reading, index) => {
    const key = `${reading.roomId}:${reading.type}:${reading.billingMonth}`;
    if (seen.has(key)) context.addIssue({
      code: "custom", message: "มีรายการมิเตอร์ซ้ำในคำขอ", path: ["readings", index],
    });
    seen.add(key);
  });
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “generate Invoice Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const generateInvoiceSchema = z.object({
  roomId: z.string().cuid(),
  billingMonth: billingMonthSchema,
  issueImmediately: z.literal(false).default(false),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “generate Bulk Invoices Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const generateBulkInvoicesSchema = z.object({
  billingMonth: billingMonthSchema,
  issueImmediately: z.literal(false).default(false),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “issue Invoice Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const issueInvoiceSchema = z.object({
  version: z.number().int().positive(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “cancel Invoice Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const cancelInvoiceSchema = z.object({
  action: z.literal("cancel"),
  version: z.number().int().positive(),
  reason: z.string().trim().min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร").max(500),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “recalculate Overdue Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const recalculateOverdueSchema = z.object({
  asOf: z.coerce.date().optional(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Meter Reading Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type MeterReadingInput = z.infer<typeof meterReadingInputSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Generate Invoice Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Billing Line” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type BillingLine = {
  type: "RENT" | "WATER" | "ELECTRICITY";
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  meterReadingId?: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “money” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกอบหรือคำนวณผลลัพธ์ของ “calculate Invoice” จากข้อมูลที่ได้รับ
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
  for (const [type, label, usage] of [
    ["WATER", "ค่าน้ำ", input.water],
    ["ELECTRICITY", "ค่าไฟ", input.electricity],
  ] as const) {
    if (!usage) continue;
    const amount = money(usage.units * usage.unitRate);
    lines.push({
      type, description: label, quantity: usage.units,
      unitPrice: money(usage.unitRate), amount, meterReadingId: usage.meterReadingId,
    });
  }
  return { lines, subtotal: money(lines.reduce((sum, line) => sum + line.amount, 0)) };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกอบหรือคำนวณผลลัพธ์ของ “calculate Due Date” จากข้อมูลที่ได้รับ
 * รับค่า:
 * - month: ค่า “month” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - billingDay: ค่า “billing Day” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - dueDay: ค่า “due Day” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function calculateDueDate(month: Date, billingDay: number, dueDay: number) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth() + (dueDay < billingDay ? 1 : 0);
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(dueDay, lastDay)));
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกอบหรือคำนวณผลลัพธ์ของ “calculate Late Fee” จากข้อมูลที่ได้รับ
 * รับค่า:
 * - dueDate: ค่า “due Date” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - asOf: ค่า “as Of” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - feePerDay: ค่า “fee Per Day” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - cap: ค่า “cap” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function calculateLateFee(dueDate: Date, asOf: Date, feePerDay: number, cap?: number | null) {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const now = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const daysLate = Math.max(0, Math.floor((now - due) / 86_400_000));
  const fee = money(daysLate * feePerDay);
  return { daysLate, fee: cap == null ? fee : Math.min(fee, money(cap)) };
}
