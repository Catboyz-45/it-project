/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “property management” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";

const money = z.coerce.number().finite().min(0).max(10_000_000);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Property Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const updatePropertySchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  shortName: z.string().trim().min(1).max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “update Property Settings Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const updatePropertySettingsSchema = z.object({
  legalName: z.string().trim().max(160).nullable().optional(),
  lessorName: z.string().trim().max(160).nullable().optional(),
  address: z.string().trim().min(1).max(1000),
  contactPhone: z.string().trim().min(1).max(30),
  contactEmail: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  promptPayId: z.string().trim().regex(/^[0-9]{10,15}$/).nullable().optional(),
  waterUnitRate: money,
  electricityUnitRate: money,
  billingDay: z.number().int().min(1).max(28),
  dueDay: z.number().int().min(1).max(31),
  lateFeePerDay: money,
  lateFeeCap: money.nullable().optional(),
  invoicePrefix: z.string().trim().min(1).max(20),
  invoiceFooter: z.string().trim().max(2000).nullable().optional(),
  houseRules: z.string().trim().max(20_000).nullable().optional(),
  emergencyContact: z.string().trim().max(500).nullable().optional(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “super Admin Property Update Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const superAdminPropertyUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  memberUserIds: z.array(z.string().cuid()).max(50).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Tenant Profile Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const updateTenantProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(8).max(30).optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  emergencyName: z.string().trim().max(160).nullable().optional(),
  emergencyPhone: z.string().trim().max(30).nullable().optional(),
  vehicle: z.object({
    type: z.enum(["MOTORCYCLE", "CAR", "BICYCLE", "OTHER"]),
    licensePlate: z.string().trim().min(1).max(30),
    province: z.string().trim().max(80).nullable().optional(),
    brandModel: z.string().trim().max(120).nullable().optional(),
    color: z.string().trim().max(80).nullable().optional(),
    detail: z.string().trim().max(500).nullable().optional(),
  }).strict().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “end Occupancy Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const endOccupancySchema = z.object({
  reason: z.string().trim().min(1).max(500),
}).strict();
