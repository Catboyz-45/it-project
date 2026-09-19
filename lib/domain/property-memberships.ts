import { z } from "zod";

// ตรวจรายการหอที่มอบสิทธิ์ให้บัญชีหนึ่ง ใช้ตอนผู้ดูแลระบบแก้สิทธิ์เจ้าของหอ
export const updatePropertyMembershipsSchema = z.object({
  // จำกัด 100 กันส่งรายการยาวมาถล่มเซิร์ฟเวอร์ ส่วน Set ตัด id ที่ซ้ำกันออก
  propertyIds: z.array(z.string().cuid()).max(100).transform((ids) => [...new Set(ids)]),
// strict ปฏิเสธฟิลด์ที่ไม่ได้ประกาศไว้ กันการแอบยัดค่าอื่นเข้ามาแก้ข้อมูลที่ไม่ได้ตั้งใจเปิดให้แก้
}).strict();

export type UpdatePropertyMembershipsInput = z.infer<typeof updatePropertyMembershipsSchema>;
