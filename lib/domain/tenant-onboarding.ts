import { z } from "zod";
import { occupancyRoleSchema, occupancyStatusSchema } from "@/lib/domain/enums";

// สร้างคำเชิญให้ผู้เช่า สิทธิ์และอายุรหัสถูกกำหนดตั้งแต่ตอนสร้าง ผู้รับเปลี่ยนเองไม่ได้
export const createInvitationSchema = z.object({
  roomId: z.cuid(),
  intendedRole: occupancyRoleSchema.default("CO_OCCUPANT"),
  // อายุไม่เกิน 30 วัน รหัสที่ค้างนานเกินไปเป็นความเสี่ยงถ้าหลุดออกไป
  expiresInDays: z.number().int().min(1).max(30).default(7),
}).strict();

// สมัครเป็นผู้เช่า ต้องมีรหัสเชิญเสมอ ไม่เปิดให้สมัครเองลอย ๆ
export const tenantRegistrationSchema = z.object({
  invitationCode: z.string().trim().min(32).max(256),
  // แปลงเป็นตัวพิมพ์เล็กก่อนเก็บ จะได้ไม่มีอีเมลเดียวกันสมัครซ้ำได้ด้วยตัวพิมพ์ต่างกัน
  // 254 คือความยาวสูงสุดของอีเมลตามมาตรฐาน
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  // อย่างน้อย 12 ตัว และต้องมีพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลขครบ
  // ตรวจที่นี่เป็นด่านจริง ส่วนที่บอกไว้ในหน้าจอมีไว้ให้ผู้ใช้รู้ล่วงหน้าเฉย ๆ
  password: z.string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/),
  displayName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  // literal(true) แปลว่าต้องเป็น true เท่านั้น ส่ง false มาก็ไม่ผ่าน ไม่ใช่แค่ไม่ส่งไม่ได้
  termsAccepted: z.literal(true, { error: "กรุณายอมรับข้อกำหนดการใช้บริการ" }),
  privacyAcknowledged: z.literal(true, { error: "กรุณารับทราบประกาศความเป็นส่วนตัว" }),
  // ข่าวสารเป็นความสมัครใจ ค่าเริ่มต้นจึงเป็นไม่ยินยอม ตามหลักการขอความยินยอม
  marketingConsent: z.boolean().default(false),
}).strict();

export const acceptTenantInvitationSchema = z.object({
  invitationCode: z.string().trim().min(32).max(256),
}).strict();

export const selectTenantOccupancySchema = z.object({
  occupancyId: z.cuid(),
}).strict();

// เอาเฉพาะสองค่านี้จากรายการสถานะเต็ม เพราะ PENDING เป็นค่าตั้งต้น ไม่ใช่ผลการตรวจ
export const reviewOccupancySchema = z.object({
  status: occupancyStatusSchema.extract(["ACTIVE", "REJECTED"]),
}).strict();

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type TenantRegistrationInput = z.infer<typeof tenantRegistrationSchema>;
export type AcceptTenantInvitationInput = z.infer<typeof acceptTenantInvitationSchema>;
export type ReviewOccupancyInput = z.infer<typeof reviewOccupancySchema>;
