import { z } from "zod";
import {
  announcementAudienceSchema,
  announcementStatusSchema,
  parcelStatusSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTypeSchema,
} from "@/lib/domain/enums";

// สร้างประกาศ ขอบเขตผู้รับเลือกได้ตั้งแต่ทั้งหอไปจนถึงระบุห้อง
export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10_000),
  audience: announcementAudienceSchema.default("ALL_TENANTS"),
  buildingId: z.string().cuid().optional(),
  floorId: z.string().cuid().optional(),
  roomIds: z.array(z.string().cuid()).max(10_000).default([]),
  // ไม่มี ARCHIVED เพราะสร้างมาเป็นเก็บเข้ากรุเลยไม่มีความหมาย ต้องไปเปลี่ยนทีหลัง
  status: announcementStatusSchema.extract(["DRAFT", "SCHEDULED", "PUBLISHED"]).default("DRAFT"),
  publishAt: z.coerce.date().optional(),
// สี่กฎที่ขึ้นกับความสัมพันธ์ระหว่างฟิลด์ ตรวจทีละฟิลด์ไม่พอ
// เลือกขอบเขตแบบเจาะจงแล้วต้องระบุเป้าหมาย และตั้งเวลาแล้วต้องบอกว่าเมื่อไร
}).strict().superRefine((value, context) => {
  if (value.audience === "BUILDING" && !value.buildingId) context.addIssue({ code: "custom", message: "กรุณาเลือกอาคาร", path: ["buildingId"] });
  if (value.audience === "FLOOR" && !value.floorId) context.addIssue({ code: "custom", message: "กรุณาเลือกชั้น", path: ["floorId"] });
  if (value.audience === "ROOM" && value.roomIds.length === 0) context.addIssue({ code: "custom", message: "กรุณาเลือกห้อง", path: ["roomIds"] });
  if (value.status === "SCHEDULED" && !value.publishAt) context.addIssue({ code: "custom", message: "กรุณาระบุเวลาเผยแพร่", path: ["publishAt"] });
});

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(10_000).optional(),
  audience: announcementAudienceSchema.optional(),
  buildingId: z.string().cuid().optional(),
  floorId: z.string().cuid().optional(),
  roomIds: z.array(z.string().cuid()).max(10_000).optional(),
  status: announcementStatusSchema.optional(),
  publishAt: z.coerce.date().optional(),
  // บังคับส่งเวลาที่แก้ล่าสุดมาด้วย เซิร์ฟเวอร์จะได้ปฏิเสธถ้ามีคนอื่นแก้ไปก่อนแล้ว
  expectedUpdatedAt: z.coerce.date(),
}).strict();

export const createParcelSchema = z.object({
  roomId: z.string().cuid(),
  recipientTenantId: z.string().cuid().optional(),
  note: z.string().trim().max(1000).optional(),
}).strict();

export const updateParcelSchema = z.object({
  // เปลี่ยนกลับเป็นรอรับไม่ได้ เพราะส่งมอบไปแล้วย้อนไม่ได้
  status: parcelStatusSchema.extract(["RECEIVED", "CANCELLED"]).optional(),
  receivedByTenantId: z.string().cuid().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  expectedUpdatedAt: z.coerce.date().optional(),
}).strict().refine((value) => value.status !== undefined || value.note !== undefined, "ไม่มีข้อมูลให้แก้ไข");

export const createTicketSchema = z.object({
  type: ticketTypeSchema,
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(4000),
  priority: ticketPrioritySchema.default("NORMAL"),
  // แจ้งแบบไม่ระบุตัวตนได้ เผื่อเรื่องร้องเรียนที่ผู้เช่าไม่อยากให้รู้ว่าใครแจ้ง
  isAnonymous: z.boolean().default(false),
}).strict();

export const updateTicketSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  detail: z.string().trim().min(1).max(4000).optional(),
  expectedUpdatedAt: z.coerce.date().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

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

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type CreateParcelInput = z.infer<typeof createParcelSchema>;
export type UpdateParcelInput = z.infer<typeof updateParcelSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateTicketReplyInput = z.infer<typeof createTicketReplySchema>;
