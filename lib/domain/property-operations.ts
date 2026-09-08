/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “property operations” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";
import {
  announcementAudienceSchema,
  announcementStatusSchema,
  parcelStatusSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTypeSchema,
} from "@/lib/domain/enums";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Announcement Schema” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10_000),
  audience: announcementAudienceSchema.default("ALL_TENANTS"),
  buildingId: z.string().cuid().optional(),
  floorId: z.string().cuid().optional(),
  roomIds: z.array(z.string().cuid()).max(10_000).default([]),
  status: announcementStatusSchema.extract(["DRAFT", "SCHEDULED", "PUBLISHED"]).default("DRAFT"),
  publishAt: z.coerce.date().optional(),
}).strict().superRefine((value, context) => {
  if (value.audience === "BUILDING" && !value.buildingId) context.addIssue({ code: "custom", message: "กรุณาเลือกอาคาร", path: ["buildingId"] });
  if (value.audience === "FLOOR" && !value.floorId) context.addIssue({ code: "custom", message: "กรุณาเลือกชั้น", path: ["floorId"] });
  if (value.audience === "ROOM" && value.roomIds.length === 0) context.addIssue({ code: "custom", message: "กรุณาเลือกห้อง", path: ["roomIds"] });
  if (value.status === "SCHEDULED" && !value.publishAt) context.addIssue({ code: "custom", message: "กรุณาระบุเวลาเผยแพร่", path: ["publishAt"] });
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “update Announcement Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(10_000).optional(),
  audience: announcementAudienceSchema.optional(),
  buildingId: z.string().cuid().optional(),
  floorId: z.string().cuid().optional(),
  roomIds: z.array(z.string().cuid()).max(10_000).optional(),
  status: announcementStatusSchema.optional(),
  publishAt: z.coerce.date().optional(),
  expectedUpdatedAt: z.coerce.date(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “create Parcel Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const createParcelSchema = z.object({
  roomId: z.string().cuid(),
  recipientTenantId: z.string().cuid().optional(),
  note: z.string().trim().max(1000).optional(),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Parcel Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const updateParcelSchema = z.object({
  status: parcelStatusSchema.extract(["RECEIVED", "CANCELLED"]).optional(),
  receivedByTenantId: z.string().cuid().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  expectedUpdatedAt: z.coerce.date().optional(),
}).strict().refine((value) => value.status !== undefined || value.note !== undefined, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “create Ticket Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const createTicketSchema = z.object({
  type: ticketTypeSchema,
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(4000),
  priority: ticketPrioritySchema.default("NORMAL"),
  isAnonymous: z.boolean().default(false),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Ticket Schema” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
export const updateTicketSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  detail: z.string().trim().min(1).max(4000).optional(),
  expectedUpdatedAt: z.coerce.date().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “create Ticket Reply Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const createTicketReplySchema = z.object({
  body: z.string().trim().min(1, "กรุณากรอกข้อความ").max(4000),
}).strict();

export const ticketTransitions = {
  OPEN: ["ACKNOWLEDGED", "CANCELLED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["ACKNOWLEDGED", "RESOLVED", "CANCELLED"],
  RESOLVED: [],
  CANCELLED: [],
} as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Announcement Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Update Announcement Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Parcel Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateParcelInput = z.infer<typeof createParcelSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Update Parcel Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type UpdateParcelInput = z.infer<typeof updateParcelSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Ticket Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Update Ticket Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Create Ticket Reply Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type CreateTicketReplyInput = z.infer<typeof createTicketReplySchema>;
