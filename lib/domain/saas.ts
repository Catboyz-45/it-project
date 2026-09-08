/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “saas” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";
import { subscriptionStatusSchema } from "@/lib/domain/enums";

const money = z.coerce.number().finite().min(0).max(10_000_000);
const code = z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9_-]+$/);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “create Saas Plan Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const createSaasPlanSchema = z.object({
  code,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  monthlyPrice: money,
  yearlyPrice: money.nullable().optional(),
  maxProperties: z.number().int().min(1).max(10_000),
  maxRooms: z.number().int().min(1).max(1_000_000),
  allowPromptPay: z.boolean().default(true),
  allowFileUploads: z.boolean().default(true),
  allowPrioritySupport: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Saas Plan Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const updateSaasPlanSchema = createSaasPlanSchema.partial().extend({
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “assign Subscription Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export const assignSubscriptionSchema = z.object({
  planId: z.string().cuid().or(z.string().regex(/^plan_[a-z0-9_-]+$/)),
  status: subscriptionStatusSchema.default("ACTIVE"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
}).strict().superRefine((value, context) => {
  if (value.expiresAt <= value.startsAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "วันหมดอายุต้องอยู่หลังวันเริ่มต้น" });
  }
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “create Subscription Order Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const createSubscriptionOrderSchema = z.object({
  planId: z.string().cuid().or(z.string().regex(/^plan_[a-z0-9_-]+$/)),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “review Subscription Payment Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export const reviewSubscriptionPaymentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionNote: z.string().trim().min(2).max(500).optional(),
}).strict().superRefine((value, context) => {
  if (value.status === "REJECTED" && !value.rejectionNote) {
    context.addIssue({ code: "custom", path: ["rejectionNote"], message: "กรุณาระบุเหตุผลที่ปฏิเสธ" });
  }
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Saas Plan Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateSaasPlanInput = z.infer<typeof createSaasPlanSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Update Saas Plan Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type UpdateSaasPlanInput = z.infer<typeof updateSaasPlanSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Assign Subscription Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type AssignSubscriptionInput = z.infer<typeof assignSubscriptionSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Subscription Order Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateSubscriptionOrderInput = z.infer<typeof createSubscriptionOrderSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Review Subscription Payment Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ReviewSubscriptionPaymentInput = z.infer<typeof reviewSubscriptionPaymentSchema>;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “monthly Equivalent” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - priceAmount: ค่า “price Amount” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - interval: ค่า “interval” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function monthlyEquivalent(priceAmount: number, interval: "MONTHLY" | "YEARLY") {
  return interval === "YEARLY" ? priceAmount / 12 : priceAmount;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “usage Percent” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - used: ค่า “used” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - limit: ค่า “limit” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function usagePercent(used: number, limit: number) {
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 10_000) / 100);
}
