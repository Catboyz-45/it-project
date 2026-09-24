import { z } from "zod";
import { subscriptionStatusSchema } from "@/lib/domain/enums";

const money = z.coerce.number().min(0).max(10_000_000);
// รหัสแพ็กเกจแปลงเป็นตัวพิมพ์ใหญ่ก่อนเก็บ จะได้ไม่มี growth กับ GROWTH เป็นคนละอันในฐานข้อมูล
const code = z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_-]+$/);

// สร้างแพ็กเกจใหม่ ค่าเริ่มต้นของความสามารถตั้งไว้แบบที่แพ็กเกจทั่วไปควรมี
export const createSaasPlanSchema = z.object({
  code,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  monthlyPrice: money,
  // ปล่อยว่างได้ หมายถึงไม่เปิดขายรายปี ระบบจะคิดจากรายเดือนคูณ 12 ให้เอง
  yearlyPrice: money.nullable().optional(),
  maxProperties: z.number().int().min(1).max(10_000),
  maxRooms: z.number().int().min(1).max(1_000_000),
  allowPromptPay: z.boolean().default(true),
  allowFileUploads: z.boolean().default(true),
  allowPrioritySupport: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
}).strict();

// แก้ไขใช้กฎเดียวกับตอนสร้าง แค่ทำให้ทุกช่องไม่บังคับ จะได้ไม่ต้องดูแลกฎสองชุด
// เพิ่ม isActive เข้ามา เพราะปิดขายแพ็กเกจได้แต่สร้างมาแบบปิดตั้งแต่แรกไม่ได้
export const updateSaasPlanSchema = createSaasPlanSchema.partial().extend({
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

export const assignSubscriptionSchema = z.object({
  // รับได้สองรูปแบบ cuid จากฐานข้อมูล กับ plan_xxx ที่เป็นรหัสของแพ็กเกจตั้งต้นที่มากับระบบ
  planId: z.cuid().or(z.string().regex(/^plan_[a-z0-9_-]+$/)),
  status: subscriptionStatusSchema.default("ACTIVE"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
}).strict().superRefine((value, context) => {
  if (value.expiresAt <= value.startsAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "วันหมดอายุต้องอยู่หลังวันเริ่มต้น" });
  }
});

export const createSubscriptionOrderSchema = z.object({
  planId: z.cuid().or(z.string().regex(/^plan_[a-z0-9_-]+$/)),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
}).strict();

export const reviewSubscriptionPaymentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionNote: z.string().trim().min(2).max(500).optional(),
}).strict().superRefine((value, context) => {
  if (value.status === "REJECTED" && !value.rejectionNote) {
    context.addIssue({ code: "custom", path: ["rejectionNote"], message: "กรุณาระบุเหตุผลที่ปฏิเสธ" });
  }
});

export type CreateSaasPlanInput = z.infer<typeof createSaasPlanSchema>;
export type UpdateSaasPlanInput = z.infer<typeof updateSaasPlanSchema>;
export type AssignSubscriptionInput = z.infer<typeof assignSubscriptionSchema>;
export type CreateSubscriptionOrderInput = z.infer<typeof createSubscriptionOrderSchema>;
export type ReviewSubscriptionPaymentInput = z.infer<typeof reviewSubscriptionPaymentSchema>;

// แปลงยอดรายปีเป็นต่อเดือน เพื่อให้เทียบรายได้ของแพ็กเกจต่างรอบบิลกันได้
export function monthlyEquivalent(priceAmount: number, interval: "MONTHLY" | "YEARLY") {
  return interval === "YEARLY" ? priceAmount / 12 : priceAmount;
}

export function usagePercent(used: number, limit: number) {
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 10_000) / 100);
}
