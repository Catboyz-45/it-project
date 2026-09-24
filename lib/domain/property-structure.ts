import { z } from "zod";
import { roomStatusSchema } from "@/lib/domain/enums";

const identifierSchema = z.string().cuid();
const moneySchema = z.coerce.number().min(0).max(10_000_000);
// \p{L} กับ \p{N} คือตัวอักษรและตัวเลขของทุกภาษา เลขห้องภาษาไทยจึงใช้ได้
// ไม่ยอมให้มีช่องว่างหรืออักขระพิเศษ เพราะเลขห้องถูกเอาไปใช้ในชื่อไฟล์และ URL
const roomNumberSchema = z.string().trim().min(1).max(30).regex(
  /^[\p{L}\p{N}-]+$/u,
  "เลขห้องใช้ได้เฉพาะตัวอักษร ตัวเลข และขีดกลาง",
);

// ตั้งชื่อแยกกันทั้งที่กฎเหมือนกัน เพื่อให้อ่านโค้ดแล้วรู้ว่ากำลังตรวจ id ของอะไร
export const propertyIdSchema = identifierSchema;
export const buildingIdSchema = identifierSchema;
export const floorIdSchema = identifierSchema;
export const roomIdSchema = identifierSchema;

// สร้างอาคารพร้อมชั้นในคำขอเดียว เพราะอาคารที่ไม่มีชั้นเลยก็ใช้งานไม่ได้
export const createBuildingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9-]+$/),
  floors: z.array(z.object({
    number: z.number().int().min(1).max(999),
    label: z.string().trim().min(1).max(80).optional(),
  }).strict()).min(1).max(200),
}).strict().superRefine((value, context) => {
  // ชั้นซ้ำต้องไม่ผ่าน เพราะเลขห้องในระบบอ้างอิงจากเลขชั้น ซ้ำแล้วจะแยกห้องไม่ออก
  // ใส่ path ลงไปถึงตำแหน่งในอาเรย์ หน้าจอจะได้ชี้ได้ว่าชั้นไหนซ้ำ
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

export const updateBuildingSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9-]+$/).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

export const createFloorSchema = z.object({
  number: z.number().int().min(1).max(999),
  label: z.string().trim().min(1).max(80).optional(),
}).strict();

export const updateFloorSchema = z.object({
  label: z.string().trim().min(1).max(80).nullable(),
}).strict();

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

export const updateRoomSchema = z.object({
  floorId: floorIdSchema.optional(),
  roomType: z.string().trim().min(1).max(80).optional(),
  monthlyRent: moneySchema.optional(),
  depositAmount: moneySchema.optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  furniture: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  status: roomStatusSchema.exclude(["OCCUPIED"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
