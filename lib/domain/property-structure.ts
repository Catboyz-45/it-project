/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “property structure” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";
import { roomStatusSchema } from "@/lib/domain/enums";

const identifierSchema = z.string().cuid();
const moneySchema = z.coerce.number().finite().min(0).max(10_000_000);
const roomNumberSchema = z.string().trim().min(1).max(30).regex(
  /^[\p{L}\p{N}-]+$/u,
  "เลขห้องใช้ได้เฉพาะตัวอักษร ตัวเลข และขีดกลาง",
);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “property Id Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const propertyIdSchema = identifierSchema;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “building Id Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const buildingIdSchema = identifierSchema;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “floor Id Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const floorIdSchema = identifierSchema;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “room Id Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const roomIdSchema = identifierSchema;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Building Schema” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export const createBuildingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9-]+$/),
  floors: z.array(z.object({
    number: z.number().int().min(1).max(999),
    label: z.string().trim().min(1).max(80).optional(),
  }).strict()).min(1).max(200),
}).strict().superRefine((value, context) => {
  const seen = new Set<number>();
  value.floors.forEach((floor, index) => {
    if (seen.has(floor.number)) {
      context.addIssue({
        code: "custom",
        message: "หมายเลขชั้นต้องไม่ซ้ำกัน",
        path: ["floors", index, "number"],
      });
    }
    seen.add(floor.number);
  });
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Building Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const updateBuildingSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9-]+$/).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “create Floor Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const createFloorSchema = z.object({
  number: z.number().int().min(1).max(999),
  label: z.string().trim().min(1).max(80).optional(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “update Floor Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const updateFloorSchema = z.object({
  label: z.string().trim().min(1).max(80).nullable(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “create Room Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const createRoomSchema = z.object({
  buildingId: buildingIdSchema,
  floorId: floorIdSchema,
  number: roomNumberSchema,
  roomType: z.string().trim().min(1).max(80),
  monthlyRent: moneySchema,
  depositAmount: moneySchema.default(0),
  capacity: z.number().int().min(1).max(100).default(1),
  furniture: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Room Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const updateRoomSchema = z.object({
  floorId: floorIdSchema.optional(),
  roomType: z.string().trim().min(1).max(80).optional(),
  monthlyRent: moneySchema.optional(),
  depositAmount: moneySchema.optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  furniture: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  status: roomStatusSchema.exclude(["OCCUPIED"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Building Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Update Building Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Floor Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Update Floor Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Room Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Update Room Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
