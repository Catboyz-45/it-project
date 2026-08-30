/**
 * หน้าที่ของไฟล์นี้: ตรรกะยืนยันตัวตน validation ทำงานเฉพาะฝั่งเซิร์ฟเวอร์เพื่อดูแลบัญชี เซสชัน 2FA หรือสิทธิ์อย่างปลอดภัย
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { z } from "zod";

/** กฎข้อมูลล็อกอิน: ชื่อผู้ใช้รับเฉพาะอักขระปลอดภัย และจำกัดความยาวรหัสผ่านที่รับเข้าระบบ */
export const loginSchema = z.object({ username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/), password: z.string().min(8).max(200) }).strict();
/** รหัสจากแอป Authenticator ต้องเป็นตัวเลข 6 หลักเท่านั้น */
export const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
/** รหัสผ่านใหม่ต้องยาวอย่างน้อย 12 ตัวและมีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และสัญลักษณ์ */
export const passwordSchema = z.object({ password: z.string().min(12).max(200).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/), confirm: z.string().max(200) }).strict().refine(value => value.password === value.confirm, { message: "Passwords do not match", path: ["confirm"] });
export const recoverySchema = z.object({ code: z.string().trim().min(9).max(20) }).strict();
