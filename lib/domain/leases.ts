/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “leases” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";
import { leaseStatusSchema } from "@/lib/domain/enums";

const money = z.coerce.number().finite().min(0).max(10_000_000);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Lease Schema” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const createLeaseSchema = z.object({
  roomId: z.string().cuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  monthlyRent: money,
  depositAmount: money.default(0),
  templateId: z.string().cuid().optional(),
}).strict().refine((value) => value.endDate >= value.startDate, {
  message: "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น",
  path: ["endDate"],
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Lease Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const updateLeaseSchema = z.object({
  expectedVersion: z.number().int().min(1),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  monthlyRent: money.optional(),
  depositAmount: money.optional(),
  templateId: z.string().cuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 1, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “transition Lease Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const transitionLeaseSchema = z.object({
  expectedVersion: z.number().int().min(1),
  status: leaseStatusSchema,
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “renew Lease Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const renewLeaseSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  monthlyRent: money,
  depositAmount: money.default(0),
}).strict().refine((value) => value.endDate >= value.startDate, {
  message: "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น",
  path: ["endDate"],
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Lease Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Update Lease Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Transition Lease Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type TransitionLeaseInput = z.infer<typeof transitionLeaseSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Renew Lease Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type RenewLeaseInput = z.infer<typeof renewLeaseSchema>;
