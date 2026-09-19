import { z } from "zod";

// ช่องที่ไม่บังคับ กรอกว่างมาก็เก็บเป็น null ไม่ใช่สตริงว่าง จะได้เช็คง่ายที่เดียว
const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).transform((value) => value || null);

// ตรวจข้อมูลที่ผู้เช่าแก้เองได้ ไม่มีอีเมลหรือห้อง เพราะสองอย่างนั้นต้องผ่านเจ้าของหอ
export const updateOwnTenantProfileSchema = z.object({
  displayName: z.string().trim().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(120),
  phone: z.string().trim().min(8, "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง").max(30),
  address: optionalText(1000),
  emergencyName: optionalText(160),
  emergencyPhone: optionalText(30),
// strict ปฏิเสธฟิลด์ที่ไม่ได้ประกาศไว้ กันการแอบยัดค่าอื่นเข้ามาแก้ข้อมูลที่ไม่ได้ตั้งใจเปิดให้แก้
}).strict();

export type UpdateOwnTenantProfileInput = z.infer<typeof updateOwnTenantProfileSchema>;
