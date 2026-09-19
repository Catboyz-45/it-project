import { z } from "zod";
import { leaseStatusSchema } from "@/lib/domain/enums";

// กฎของช่องจำนวนเงิน finite กัน Infinity กับ NaN ส่วนเพดานกันกรอกเกินจริงจนผิดสังเกต
const money = z.coerce.number().finite().min(0).max(10_000_000);

// สร้างสัญญาใหม่ ไม่มีช่องสถานะ เพราะสัญญาต้องเกิดเป็นร่างเสมอ
export const createLeaseSchema = z.object({
  roomId: z.string().cuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  monthlyRent: money,
  depositAmount: money.default(0),
  templateId: z.string().cuid().optional(),
// refine เพราะเงื่อนไขขึ้นกับสองฟิลด์ ตรวจทีละฟิลด์ไม่พอ path ทำให้ข้อความไปขึ้นที่ช่องที่ถูกต้อง
}).strict().refine((value) => value.endDate >= value.startDate, {
  message: "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น",
  path: ["endDate"],
});

export const updateLeaseSchema = z.object({
  // บังคับส่ง version มาด้วย เซิร์ฟเวอร์จะได้ปฏิเสธถ้ามีคนอื่นแก้ไปก่อนแล้ว
  expectedVersion: z.number().int().min(1),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  monthlyRent: money.optional(),
  depositAmount: money.optional(),
  templateId: z.string().cuid().nullable().optional(),
// มากกว่า 1 เพราะ expectedVersion นับเป็นหนึ่งแล้ว ส่งมาแต่ version เฉย ๆ คือไม่ได้แก้อะไร
}).strict().refine((value) => Object.keys(value).length > 1, "ไม่มีข้อมูลให้แก้ไข");

export const transitionLeaseSchema = z.object({
  expectedVersion: z.number().int().min(1),
  status: leaseStatusSchema,
}).strict();

// ต่อสัญญาไม่ต้องส่ง roomId เพราะต่อจากสัญญาเดิมซึ่งผูกกับห้องอยู่แล้ว
export const renewLeaseSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  monthlyRent: money,
  depositAmount: money.default(0),
}).strict().refine((value) => value.endDate >= value.startDate, {
  message: "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น",
  path: ["endDate"],
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
export type TransitionLeaseInput = z.infer<typeof transitionLeaseSchema>;
export type RenewLeaseInput = z.infer<typeof renewLeaseSchema>;
